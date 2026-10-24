# Macas Moon: guía del proyecto

Web de glamping en Monteverde con catálogo, galería, servicios, experiencias y
reservas directas. El administrador gestiona disponibilidad, precios e incidencias.

| Alojamiento | Identificador | Capacidad | Precio base por noche |
| --- | --- | --- | --- |
| Domo Romántico | `domo-romantico` | 2 huéspedes | USD 170 |
| Domo Amplio | `domo-amplio` | 4 huéspedes | USD 170 |

Los precios especiales se configuran por fecha y domo. La salida no cuenta como
noche: una estancia del 10 al 11 ocupa y cobra solo la noche del 10.

## Qué leer

- [Configuración y publicación](configuracion-y-deploy.md): desarrollo local,
  variables, base de datos, Netlify y cambio autorizado a cobros reales.
- [Manual del administrador](operacion.md): calendarios, precios, bloqueos,
  anulaciones, pagos, correos e incidencias.
- [Comandos disponibles](../scripts/README.md): propósito y efectos de cada script.

## Entorno de trabajo

Rama `feature/reservas`, proyecto Netlify **macasmoon-reservas-testing**, URL
**https://macasmoon-reservas-testing.netlify.app**. Ambos domos requieren pago;
Tilopay permanece en **Test** hasta autorización expresa del propietario.
Los commits, pushes y despliegues los realiza el propietario. No modificar `main`
ni el sitio principal `macasmoon.com` como parte de estas pruebas.

El propietario indica que el sitio principal aún no está activo y que utiliza la
URL de pruebas. El proyecto estuvo pausado anteriormente: verificar su estado en
Netlify antes de interpretar un 404. Una consulta automatizada del 23 de octubre
de 2026 recibió 404; no permitió comprobar la revisión, variables ni migraciones
publicadas. No se atribuyó esa respuesta a un fallo del código.

## Cómo funciona una reserva

1. La web combina las noches locales con los iCal de Airbnb y Expedia de cada domo.
   Antes de reservar, vuelve a consultar ambas fuentes; si alguna falla, no acepta
   nuevas reservas ni bloqueos manuales.
2. El huésped elige fechas y consulta el total antes de escribir sus datos y pagar.
   El calendario público no muestra precios diarios; el administrador sí.
3. El servidor comprueba precio, moneda, capacidad y disponibilidad. Las noches
   se asignan en una transacción con restricción única por domo y noche.
4. Se crea un enlace Tilopay de un solo uso. El retorno y el webhook solicitan una
   verificación autenticada: por sí solos no prueban un pago. Deben coincidir la
   identidad exacta, importe, moneda, aprobación, captura y entorno.
5. Si el pago se verifica con el bloqueo vigente, se confirma la reserva y se
   intentan dos correos separados, al huésped y al negocio. Cada envío conserva
   su resultado y reintentos; un fallo de correo no anula la reserva.
6. Solo se exportan al iCal las reservas locales confirmadas y los bloqueos manuales
   activos, sin datos personales. No se exportan pendientes ni cierres importados.

Para solicitudes nuevas, desde su creación: plazo objetivo del enlace **10 minutos**,
retención de noches **15 minutos**. Un único respaldo programado cada **5 minutos**
coordina verificaciones, cierres y correos. Solicita el cierre en la primera revisión
posterior al minuto 10, normalmente entre los minutos 10 y 15; los fallos o la
acumulación pueden retrasarlo. No hay cierre exacto ni máximo garantizado.
Cerrar el enlace no libera antes las noches. Estas vencen por su fecha aunque
Tilopay falle; las confirmadas se conservan. Los registros anteriores mantienen
sus plazos originales. Un pago tras perder el bloqueo queda como incidencia,
nunca recupera noches automáticamente.

iCal conserva retrasos y riesgo de reservas cruzadas entre plataformas. La
restricción de PostgreSQL protege las reservas de esta web; no bloquea de forma
instantánea el inventario de Airbnb o Expedia. SMTP tampoco garantiza entrega
exactamente una vez: un fallo tras aceptar un correo y antes de registrarlo puede
ocasionar un duplicado. La confirmación de reserva no es una factura fiscal.

## Dónde está cada parte

Next.js, React, TypeScript y Tailwind forman la web. PostgreSQL guarda las reservas;
Netlify aloja la aplicación y ejecuta el respaldo. Tilopay procesa pagos,
Cloudflare Turnstile comprueba el formulario y Gmail envía los correos.

| Ruta | Contenido |
| --- | --- |
| `src/app/` | Páginas públicas, `/reservar`, `/reservar/estado`, `/admin` y APIs. |
| `src/components/` | Interfaz, calendario público y panel administrativo. |
| `src/data/` | Domos, servicios, galería, reseñas, preguntas frecuentes y reglas. |
| `src/i18n/` | Selector y traducciones de español, inglés, francés y alemán. |
| `src/lib/` | Reservas, pagos, correo, precios, iCal, autenticación y registros seguros. |
| `public/assets/` | Fotos y recursos públicos; nunca colocar secretos o SQL aquí. |
| `src/app/fonts/` | Fuentes locales y sus licencias, que deben conservarse. |
| `netlify/functions/` | Función programada de conciliación. |
| `netlify/database/migrations/` | Migraciones SQL para Netlify; no contiene una segunda base. |
| `db/` | Copias equivalentes para aplicar migraciones manualmente o en una base local. |
| `scripts/`, `tests/` | Herramientas de mantenimiento y pruebas con proveedores simulados. |

Para cambiar contenido, editar `src/data/` y las traducciones correspondientes.
Contacto y URL base están en `src/lib/site.ts`; SEO, sitemap y robots se generan
desde la aplicación. En Test, `robots.txt` solicita a los buscadores no rastrear el sitio.
La integración anterior de Cloudbeds y el formulario de WhatsApp se conservan en
el código, pero `/reservar` utiliza el flujo directo de PostgreSQL + iCal + Tilopay.
Una conversación de WhatsApp no bloquea noches por sí sola.

## Estado y condiciones para lanzar

**Última validación del código, 23 de octubre de 2026:** 94 pruebas, lint,
TypeScript y compilación. En la reorganización documental se comprobaron enlaces,
se repitió la auditoría de exposición sin hallazgos y pasaron 29 comprobaciones HTTP
aisladas. Las pruebas utilizan PostgreSQL embebido y proveedores simulados;
no certifican el comercio publicado, entrega real de correo ni liquidación bancaria.
La simulación de concurrencia no reproduce todos los bloqueos de PostgreSQL remoto.

Las migraciones **0009 y 0010 están preparadas localmente**; su aplicación remota
no está comprobada. La 0010 conserva identidades obtenidas del detalle autenticado
de cada enlace para verificar transacciones aunque ese detalle desaparezca con
HTTP 400/404. No reconstruye identidades de enlaces eliminados anteriormente.

**Pendiente crítico:** si un pago está en proceso y todavía no aparece en el detalle
al eliminar el enlace, no hay identidad autenticada que conservar. Hace falta
verificar con Tilopay una vía fiable de recuperación antes de vender. Esperar
cinco minutos o confiar en el webhook no resuelve esa vinculación.
La documentación de [webhooks](https://tilopay.com/developers/api/webhooks) indica
un solo intento para compras y remite a soporte para el algoritmo de `orderHash`.
No se ha implementado una firma supuesta ni contactado al proveedor.

Pruebas de aceptación pendientes en el sitio publicado, siempre con el comercio
en Test y fechas acordadas: una reserva completa por cada domo, retorno, webhook,
confirmación, dos correos, iCal correcto, rechazo, abandono, pago durante el cierre,
pago tardío sin recuperar noches, enlaces antiguos/HTTP 400/`Just Once`, precios
especiales y total desactualizado, anulación, bloqueo parcial y resolución de
incidencias con historial. Probar también móvil, idiomas y billeteras habilitadas
por el comercio; la web no activa Apple Pay/Google Pay por sí sola.

Antes de ventas reales también faltan:

- Aprobar políticas, impuestos, cargos y tratamiento del pago tardío. La FAQ dice
  «no reembolsables» y exige un mes para cancelar; las reglas piden consultar al
  anfitrión. Los dueños deben unificar esos textos.
- Aprobar la información de privacidad, conservación y atención al huésped;
  no se encontró una página específica en las rutas revisadas.
- Definir responsables y alertas para incidencias, fallos del respaldo y correo;
  los avisos del panel y logs no prueban que exista una alerta externa.
- Comprobar carga y recuperación ante caídas: los lotes de pagos y correos comparten
  presupuesto de tiempo, sin garantía de atención dentro de 15 minutos.
- Verificar retención de respaldos y restaurar una copia en una base aislada.
- Confirmar importación y reapertura de fechas en ambos anuncios de Airbnb y Expedia.
