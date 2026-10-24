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
| `TILOPAY_EXPECTED_ENVIRONMENT` | `Test`; no cambia el modo real del comercio. |
| `BOOKING_RECONCILE_ENABLED` | `true`: respaldo de pagos, cierres y correos. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Clave pública del widget para el dominio de pruebas. |
| `SMTP_USER` | Gmail remitente y destinatario del aviso al negocio. |
| `ADMIN_USERNAME` | De 3 a 80 caracteres: letras, números, punto, guion o guion bajo. |
| `BOOKING_REPLY_TO` | Opcional; si está vacío, las respuestas van a `SMTP_USER`. |
| `TILOPAY_MERCHANT_ID` | Opcional; si se define, debe coincidir con el comercio del pago. |

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
- **Turnstile:** widget Managed con hostname `macasmoon-reservas-testing.netlify.app`,
  clave pública y privada del mismo widget. No usar claves de demostración ni
  desactivar el control. No necesita mover DNS para esta integración.
- **Tilopay:** usar las credenciales del comercio y verificar su modo Test en el
  portal antes de probar. Usar solo las [tarjetas ficticias oficiales](https://tilopay.com/developers/tarjetas-de-prueba).
  No repetir un pago aprobado para diagnosticar un fallo de confirmación.

## Base de datos y migraciones

La base real es PostgreSQL. `netlify/database/migrations/` contiene instrucciones
SQL para el sistema nativo de Netlify; `db/` mantiene copias para aplicación manual.
No son dos bases ni archivos con las reservas. En una base nueva aplicar en orden
**0001 a 0010**; en una existente, solo las pendientes, sin borrar tablas o datos.
Para instalación manual usar los archivos equivalentes `001` a `010` de `db/`.

| Migraciones | Qué incorporan |
| --- | --- |
| 0001–0003 | Reservas/noches, administrador, enlaces y aviso separado al negocio. |
| 0004–0006 | Anulaciones, diagnóstico/consumo de enlaces y entorno histórico del pago. |
| 0007–0008 | Precios por fecha e historial de resolución de incidencias. |
| 0009–0010 | Vencimiento separado del enlace, identidades de intentos y errores de verificación. |

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

El respaldo único cada 5 minutos implica 288 ejecuciones diarias y 8.640 en 30 días;
consulta la base incluso sin trabajo. Hosting, base, correo y pasarela pueden tener
costos: esta frecuencia no garantiza que alcance un plan concreto. Comparar consumo
tras publicar sin añadir sondeos permanentes. Consultar el panel no cierra enlaces;
la importación iCal usa caché por instancia, y al reservar se fuerza una lectura nueva.

## Cobros reales: solo con autorización expresa

Primero resolver el pendiente de seguimiento de pagos de la [guía del proyecto](README.md),
completar aceptación, políticas, privacidad, alertas y restauración de respaldos.
Atender enlaces e incidencias Test en su entorno original; liberar desde `/admin`
las noches ficticias y comprobar reapertura externa conservando el historial.

Después, con autorización, habilitar el comercio real en Tilopay y establecer
`TILOPAY_EXPECTED_ENVIRONMENT=Production`, con las credenciales que correspondan.
Mantener pago obligatorio, tarifas y respaldo. Validar el archivo definitivo con
`npm run check:netlify-env -- archivo-privado --production`, importar y publicar.
La variable de la web no cambia el modo de la cuenta; Test y Producción comparten
host. El historial Test conserva su entorno y no se consulta con el de Producción.
Comprobar después un cobro real autorizado, correos y liquidación.

Cambiar a `macasmoon.com` o a otro proyecto/base requiere además dominio, Turnstile,
variables, migraciones y enlaces de anuncios; no forma parte de la autorización
actual. Referencias: [entornos Tilopay](https://tilopay.com/developers/entornos),
[importación de variables](https://docs.netlify.com/build/environment-variables/get-started/#import-variables-with-the-netlify-ui)
y [escaneo de secretos](https://docs.netlify.com/build/environment-variables/secrets-scanning/).
