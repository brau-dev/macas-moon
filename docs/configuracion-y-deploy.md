# Configuración y publicación

Alcance, arquitectura y pendientes: [guía del proyecto](README.md).
Los comandos se ejecutan desde la raíz con **Node 24**, también configurado en `netlify.toml`.

## Desarrollo local

```bash
nvm use 24
npm ci
npm run dev
```

Next.js lee `.env.local`; no carga automáticamente `.env.netlify`.
Si falta la configuración local, usar [`.env.example`](../.env.example) como plantilla
sin sobrescribir archivos privados existentes. Para reservas hace falta PostgreSQL
aislado con `DATABASE_URL`, migraciones aplicadas y los iCal correspondientes.
Abrir `/reservar` o `/admin/login` en `http://localhost:3000`.

La vía gratuita se conserva solo para pruebas deliberadas en localhost durante
desarrollo o en un sitio Netlify separado permitido por el servidor: habilitar
`NEXT_PUBLIC_BOOKING_TEST_MODE=true`, definir `BOOKING_TEST_SECRET` de al menos
24 caracteres seguros y poner `TILOPAY_CHECKOUT_ENABLED=false` y
`BOOKING_RECONCILE_ENABLED=false`. Mantener las demás variables de reserva, precios
y calendarios. No trasladar estos indicadores al maestro de pago obligatorio.
Aunque sea ficticia, una reserva confirmada puede bloquear anuncios reales si
importan ese iCal; usar fechas autorizadas y comprobar la reapertura al terminar.

## Variables vigentes

`.env.netlify` es el **maestro local privado**. Un push no lo importa en Netlify.
No subir `.env*` privados a Git ni compartir valores, conexiones o enlaces iCal.
Los únicos archivos para importar son los dos generados con `npm run env:split`:

| Archivo | «Contains secret values» | Alcances |
| --- | --- | --- |
| `.env.netlify.sin-secretos` | Desmarcado | Builds + Functions |
| `.env.netlify.secretos` | Marcado | Functions |

Editar el maestro y regenerar ambos; no editar las copias por separado ni importar
el maestro entero con una sola casilla. `npm run check:deploy` también las regenera.
Los comentarios `.env` no configuran casillas ni permisos en Netlify.

| Variables sin marcar como secretas | Valor o finalidad |
| --- | --- |
| `BOOKING_ENABLED` | `true` |
| `BOOKING_ACTIVE_DOMES` | `domo-romantico,domo-amplio` |
| `BOOKING_CURRENCY` | `USD` |
| `PRICE_DOMO_ROMANTICO_CENTS`, `PRICE_DOMO_AMPLIO_CENTS` | `17000` cada una: USD 170 por noche. |
| `NEXT_PUBLIC_BOOKING_TEST_MODE` | `false`: pago obligatorio. |
| `TILOPAY_CHECKOUT_ENABLED` | `true` |
| `TILOPAY_EXPECTED_ENVIRONMENT` | `Production`; debe coincidir con el modo real del comercio. |
| `BOOKING_RECONCILE_ENABLED` | `true`: respaldo de pagos, cierres y correos. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Clave pública del widget que permita el dominio final. |
| `SMTP_USER` | Gmail remitente y destinatario del aviso al negocio. |
| `ADMIN_USERNAME` | De 3 a 80 caracteres: letras, números, punto, guion o guion bajo. |
| `BOOKING_REPLY_TO` | Opcional; si está vacío, las respuestas van a `SMTP_USER`. |
| `TILOPAY_MERCHANT_ID` | Opcional; si se define, debe coincidir con el comercio del pago. |
| `NEXT_PUBLIC_GA_ID` | Identificador opcional de medición de Google Analytics, en Builds. |

| Variables secretas | Finalidad |
| --- | --- |
| `ICAL_DOMO_ROMANTICO_AIRBNB_URL`, `ICAL_DOMO_ROMANTICO_EXPEDIA_URL` | Exportaciones privadas de los anuncios del romántico. |
| `ICAL_DOMO_AMPLIO_AIRBNB_URL`, `ICAL_DOMO_AMPLIO_EXPEDIA_URL` | Exportaciones privadas de los anuncios del amplio. |
| `TILOPAY_API_USER`, `TILOPAY_API_PASSWORD`, `TILOPAY_API_KEY` | Credenciales de integración del comercio. |
| `TURNSTILE_SECRET_KEY` | Clave privada del mismo widget de Turnstile. |
| `SMTP_PASSWORD` | Contraseña de aplicación de Gmail, 16 caracteres; nunca la normal. |
| `ADMIN_PASSWORD_HASH` | Hash completo generado con `npm run admin:password`. |
| `BOOKING_RECONCILE_SECRET` | Clave interna de al menos 32 caracteres seguros. |

`URL`, `SITE_ID` y `NETLIFY_DB_URL` los proporciona Netlify: no sobrescribirlos ni
importarlos. `DATABASE_URL` solo se necesita con PostgreSQL local/externo y es
secreta. Retirar de Netlify la antigua `BOOKING_TEST_SECRET` en el flujo de pago
obligatorio: importar un archivo no elimina variables ausentes.
Los contactos públicos opcionales `NEXT_PUBLIC_WHATSAPP_URL` y
`NEXT_PUBLIC_CONTACT_EMAIL` están descritos en `.env.example`; las variables
anteriores de Cloudbeds no habilitan el flujo actual de `/reservar`.

Comprobar formato y clasificación con `npm run check:netlify-env -- --classify`.
La opción `-- --fetch` consulta los iCal privados sin cambiar reservas; no verifica
que las plataformas hayan importado nuestros calendarios. No añadir credenciales
a `NEXT_PUBLIC_*`, desactivar el escaneo de secretos ni excluir carpetas para
eludir un hallazgo. Si se expuso una credencial, rotarla y revisar el historial.

## Preparar o renovar servicios

- **Administrador:** `npm run admin:password` pide una contraseña de al menos
  12 caracteres en una terminal interactiva. Guardar el hash completo en el
  maestro; para ingresar se usa la contraseña original. Cambiar usuario o hash
  invalida sesiones anteriores. No hay credenciales predeterminadas.
- **Gmail:** activar verificación en dos pasos y obtener una
  [contraseña de aplicación](https://myaccount.google.com/apppasswords).
  `npm run check:smtp` prueba autenticación sin enviar mensajes, pero no acredita
  entrega ni conexión desde Netlify. No requiere Resend ni comprar otro correo.
- **Turnstile:** widget Managed que permita `macasmoonglampings.com` en producción
  y `macasmoon-reservas-testing.netlify.app` durante pruebas,
  clave pública y privada del mismo widget. No usar claves de demostración ni
  desactivar el control. No necesita mover DNS para esta integración.
- **Tilopay:** comprobar en el portal que el modo del comercio coincida con
  `TILOPAY_EXPECTED_ENVIRONMENT`. Las [tarjetas ficticias oficiales](https://tilopay.com/developers/tarjetas-de-prueba)
  se usan únicamente en Test; en Production hay cobros reales. No repetir un pago
  aprobado para diagnosticar un fallo de confirmación.

## Base de datos y migraciones

La base real es PostgreSQL. `netlify/database/migrations/` contiene instrucciones
SQL para el sistema nativo de Netlify; `db/` mantiene copias para aplicación manual.
No son dos bases ni archivos con las reservas. En una base nueva aplicar en orden
**0001 a 0010 y 0012**; en una existente, solo las pendientes.
Para instalación manual usar los archivos equivalentes `001` a `010` y `012` de `db/`.
La numeración conserva un salto porque se retiró una integración que no se desplegó.

| Migraciones | Qué incorporan |
| --- | --- |
| 0001–0003 | Reservas/noches, administrador, enlaces y aviso separado al negocio. |
| 0004–0006 | Anulaciones, diagnóstico/consumo de enlaces y entorno histórico del pago. |
| 0007–0008 | Precios por fecha e historial de resolución de incidencias. |
| 0009–0010 | Vencimiento separado del enlace, identidades de intentos y errores de verificación. |
| 0012 | Versión y fecha de aceptación de condiciones y privacidad. |

Comprobar la aplicación en el registro de despliegue y en la base correspondiente;
compilar no demuestra que estén aplicadas. La 0006 identifica como Test el historial
de este proyecto, que solo ha operado en pruebas: no reutilizarla para cobros previos
de origen desconocido. La 0010 no recupera identidades de enlaces ya eliminados.
[Migraciones de Netlify](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/).

## Publicar en el proyecto de pruebas

1. Comprobar `feature/reservas` y el proyecto **macasmoon-reservas-testing**.
   Ejecutar `npm run check:deploy`: valida configuración, pruebas simuladas,
   lint, compilación, tipos y exposición. No publica, cobra ni envía correos.
2. En Netlify, **Project configuration → Environment variables → Import from a .env file**,
   importar primero el archivo sin secretos y después el de secretos, según la
   tabla. Elegir actualizar conflictos solo tras confirmar el proyecto correcto.
   «Same value for all deploy contexts» es admisible en este proyecto aislado;
   «Production» de Netlify significa su URL principal, no cobros reales en Tilopay.
3. Revisar casillas y alcances. Si una variable pública como `SMTP_USER` ya estaba
   marcada secreta, eliminar solo esa variable y recrearla sin esa casilla;
   no publicar entre ambos pasos. No mezclar credenciales reales con previews.
4. El propietario revisa, hace commit/push y publica solo este proyecto. Netlify
   usa `netlify.toml`: Node 24, `npm run build`, salida `.next` y plugin de Next.js.
   Si existe un override antiguo `AWS_LAMBDA_JS_RUNTIME`, alinear a Node 24 o retirarlo.
   Comprobar las migraciones pendientes antes de usar el nuevo código.
5. Verificar en Netlify si el proyecto está activo; si sigue pausado, reactivarlo
   cuando el propietario decida probar. Un 404 aislado no explica su causa.
6. Ejecutar `npm run check:published` y revisar las pruebas de aceptación de la
   [guía del proyecto](README.md). Comprueba precios e iCal mediante lecturas públicas;
   no comprueba pagos ni correo. Si falla, diagnosticar antes de hacer otra compra.

El respaldo se activa cada 5 minutos. Si una ejecución comprueba que no queda
trabajo, guarda una marca de hasta una hora en Netlify Blobs. Las siguientes
ejecuciones consultan esa marca sin abrir PostgreSQL. Una reserva nueva anula la
marca antes de mostrar el enlace de pago. Las verificaciones de pagos y correos
pendientes mantienen su frecuencia de 5 minutos. Si falla la lectura de la marca,
el respaldo consulta PostgreSQL con la frecuencia habitual. Netlify proporciona
el acceso a Blobs al código ejecutado en su plataforma.

Comparar las unidades de cómputo durante un período similar tras publicar. Los
calendarios externos y las consultas de visitantes también pueden despertar la base.
Consultar el panel no cierra enlaces. La importación iCal usa caché por instancia
y al reservar se fuerza una lectura nueva.

## Preparación de cobros reales

El propietario autorizó preparar `Production` el 16 de noviembre de 2026. El maestro
local y sus archivos de importación requieren pago obligatorio, entorno esperado
`Production` y respaldo activo; no contienen una clave para reservas gratuitas.
El servidor rechaza esa vía gratuita en `Production` incluso si se activa por error
su indicador. El despliegue y el ajuste del comercio en Tilopay se comprueban aparte.

Primero completar las pruebas de pagos y gestión manual de incidencias de la
[guía del proyecto](README.md) y comprobar la restauración de respaldos.
Atender enlaces e incidencias Test en su entorno original; liberar desde `/admin`
las noches ficticias y comprobar reapertura externa conservando el historial.

Habilitar el comercio real en Tilopay y establecer
`TILOPAY_EXPECTED_ENVIRONMENT=Production`, con las credenciales que correspondan.
Mantener pago obligatorio, tarifas y respaldo. Validar el archivo definitivo con
`npm run check:netlify-env -- archivo-privado --production` y ejecutar
`npm run check:deploy -- --production` antes de importar y publicar.
La variable de la web no cambia el modo de la cuenta; Test y Producción comparten
host. El historial Test conserva su entorno y no se consulta con el de Producción.
Comprobar después un cobro real autorizado, correos y liquidación.

El destino confirmado es **macasmoonglampings.com**. El propietario indica que
`main` ya está conectado al despliegue de ese dominio y realizará el push.

- Antes del push, importar los archivos de entorno regenerados en el proyecto y
  contexto de producción. Los `.env` privados no se incluyen en Git: el push no
  actualiza sus valores en Netlify.
- Netlify debe suministrar `URL=https://macasmoonglampings.com`; no importar
  manualmente esa variable gestionada por la plataforma. El servidor la usa para
  retornos de pago, webhook, comprobación de origen y correos. La URL alternativa
  del sitio y `check:published` también apuntan a este dominio en producción.
- El widget Turnstile debe permitir el dominio final y sus claves deben corresponder
  al widget real. Habilitar Netlify Database en el proyecto de producción. El sitio
  actual es estático, así que una base nueva requiere las migraciones 0001 a 0010
  y 0012. Con Netlify Database, se aplican al publicar el nuevo deploy. Revisar
  el registro y mantener los datos de prueba en su proyecto separado.
- Comprobar el respaldo programado en Functions y configurar los iCal de
  producción en los anuncios de Airbnb y Expedia.
- Tras el push, ejecutar `npm run check:published`. La autenticación API de Tilopay
  no acredita que el comercio esté en modo real. El propietario confirmó que
  desactivó el modo de prueba. Verificar la primera operación real autorizada,
  incluido el retorno y la entrega del webhook con la URL registrada al crear
  el enlace. Si la pasarela ya no ofrece el detalle de un enlace cerrado, un
  webhook autenticado por su URL y contrastado con la consulta de Tilopay genera
  una incidencia manual, sin confirmar la reserva.

Referencias: [entornos Tilopay](https://tilopay.com/developers/entornos),
[importación de variables](https://docs.netlify.com/build/environment-variables/get-started/#import-variables-with-the-netlify-ui)
y [escaneo de secretos](https://docs.netlify.com/build/environment-variables/secrets-scanning/).
