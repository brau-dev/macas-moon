# Importar variables: sitio casi final con Tilopay Test

Dos archivos preparados en la raíz del proyecto, con los mismos valores del archivo
maestro `.env.netlify`:

| Archivo para importar | «Contains secret values» | Alcances |
|---|---|---|
| `.env.netlify.sin-secretos` (14 variables) | Desmarcado para todas | Builds + Functions |
| `.env.netlify.secretos` (11 variables) | Marcado para todas | Functions |

Haz **dos importaciones**, una por archivo. No necesitas configurar once secretos
individualmente. Ambos archivos están excluidos de Git y tienen permisos privados.
No publiques sus contenidos ni los pegues en un chat. No importes el archivo maestro
completo usando una única casilla para todo, porque contiene ambos tipos.

Se mantienen ambos domos habilitados, USD, base de US$170 por noche, pago
obligatorio, Tilopay **Test** y respaldo de pagos/correos activado.

## 1. Importa primero el archivo sin secretos y después el de secretos

1. Abre **macasmoon-reservas-testing → Project configuration → Environment variables**.
2. Pulsa **Add a variable → Import from a .env file**.
3. Copia todo el contenido de **`.env.netlify.sin-secretos`** al cuadro de importación.
   Deja **Contains secret values desmarcado** para todo este lote.
   Selecciona los alcances **Builds y Functions**. Los ajustes que no son secretos
   necesitan Functions aunque no aparezcan en el navegador.
4. Netlify reconoce una variable por cada línea `NOMBRE=valor`. Los comentarios
   que comienzan con `#` no se importan como variables.
5. Usa **Same value for all deploy contexts / All deploy contexts** en este proyecto
   separado de pruebas. El contexto **Production de Netlify** es la URL principal
   del proyecto; no cambia el modo de Tilopay.
6. Selecciona **Update conflicts**, no «Skip conflicts», para sustituir valores viejos.
7. Importa este primer archivo.
8. Repite **Add a variable → Import from a .env file** con todo el contenido de
   **`.env.netlify.secretos`**. Esta vez **marca Contains secret values para todo el
   lote**, usa alcance **Functions**, los mismos contextos y **Update conflicts**.
9. Después de las dos importaciones, continúa con la preparación del deploy.

La importación mezcla variables con las ya existentes; no borra automáticamente
las que no están en el archivo. [Importación oficial de Netlify](https://docs.netlify.com/build/environment-variables/get-started/#import-variables-with-the-netlify-ui).

## 2. Variables SIN «Contains secret values»

Estas variables están en `.env.netlify.sin-secretos`. Importa ese archivo entero sin
la casilla y con Builds + Functions:

```text
BOOKING_ACTIVE_DOMES
BOOKING_ENABLED
BOOKING_CURRENCY
PRICE_DOMO_ROMANTICO_CENTS
PRICE_DOMO_AMPLIO_CENTS
NEXT_PUBLIC_BOOKING_TEST_MODE
TILOPAY_CHECKOUT_ENABLED
BOOKING_RECONCILE_ENABLED
TILOPAY_EXPECTED_ENVIRONMENT
NEXT_PUBLIC_TURNSTILE_SITE_KEY
SMTP_USER
BOOKING_REPLY_TO
ADMIN_USERNAME
TILOPAY_MERCHANT_ID
```

`SMTP_USER` es el correo remitente, no su contraseña. Es también el contacto público
del negocio; marcarlo como secreto puede hacer fallar el escaneo porque aparece en
la web y en la documentación. La contraseña está en **SMTP_PASSWORD**, que sí es secreta.

`TILOPAY_MERCHANT_ID` y `BOOKING_REPLY_TO` son opcionales y están vacías si no se
han definido. No inventes un ID: el código admite el comercio autenticado con las
credenciales actuales y, cuando se configura ese ID, lo comprueba en el pago.

**Si alguna ya estaba marcada como secreta:** Netlify no permite desmarcarla para
revelar el valor. Elimina SOLO esa variable desde **Options → Delete** y vuelve a
crearla con el valor del archivo privado, sin marcar la casilla. No borres todas las
variables ni publiques entre estos pasos. [Política de secretos](https://docs.netlify.com/build/environment-variables/secrets-controller/).

## 3. Variables CON «Contains secret values»

Todas están en `.env.netlify.secretos`. Al importar ese archivo, marca la casilla
para el lote completo y usa alcance **Functions**, sin Builds ni Post processing.
Una vez secretas, Netlify no vuelve a mostrar sus valores en texto claro.

```text
ICAL_DOMO_ROMANTICO_AIRBNB_URL
ICAL_DOMO_ROMANTICO_EXPEDIA_URL
ICAL_DOMO_AMPLIO_AIRBNB_URL
ICAL_DOMO_AMPLIO_EXPEDIA_URL
TILOPAY_API_USER
TILOPAY_API_PASSWORD
TILOPAY_API_KEY
TURNSTILE_SECRET_KEY
SMTP_PASSWORD
ADMIN_PASSWORD_HASH
BOOKING_RECONCILE_SECRET
```

Los comentarios del `.env` NO configuran estas casillas automáticamente: escoge la
opción correspondiente en cada importación. Es seguro marcar todo **el archivo de
secretos**, pero no el archivo maestro que mezcla ambos grupos.
[Política de secretos](https://docs.netlify.com/build/environment-variables/secrets-controller/).

## 4. Qué NO debes añadir ni reemplazar

- **URL, SITE_ID y NETLIFY_DB_URL:** los proporciona Netlify. No son enlaces de Airbnb.
- **DATABASE_URL:** no hace falta con la base nativa actual. Si algún día usas una
  conexión externa, será secreta, pero no reemplaces ahora la conexión de Netlify.
- **BOOKING_TEST_SECRET:** retirada del archivo de deploy. Si todavía existe en
  Netlify, elimina esa variable. El código de reservas sin cobro se conserva para
  pruebas locales deliberadas, pero aquí `NEXT_PUBLIC_BOOKING_TEST_MODE=false`.
- No desactives el escaneo de secretos ni añadas credenciales a las excepciones.

Comprueba los nombres y su clasificación sin mostrar valores:

```bash
npm run check:netlify-env -- --classify
```

El archivo se importa desde tu equipo: **un push no sube `.env.netlify`**. No uses
`git add -f` para incluirlo.

Si cambias algún valor en el maestro `.env.netlify`, actualiza las dos copias con:

```bash
npm run env:split
```

`npm run check:deploy` también las regenera antes de las comprobaciones. No edites
las copias por separado: usa el maestro para evitar valores desactualizados.

## 5. Publicar ahora y cambiar a cobros reales después

El sitio de pruebas está pausado por decisión del propietario. No necesitas
reactivarlo para estas comprobaciones locales. Antes de publicar, importa y revisa
las variables, comprueba la rama `feature/reservas` y las migraciones 0001–0008.
Reactiva el proyecto cuando estés listo para publicar y hacer las pruebas de
aceptación de [deploy-casi-final.md](deploy-casi-final.md).

Después del deploy, `npm run check:published` verifica los precios por fecha y los
dos iCal, sin crear reservas, hacer pagos ni enviar correos. Mientras el proyecto
esté pausado puede responder 404 y esta comprobación no podrá completarse.

Si las pruebas de aceptación pasan y no cambias de proyecto/dominio/base, el cambio
previsto para cobros reales no necesita más programación: cambia el modo del
comercio en Tilopay y **TILOPAY_EXPECTED_ENVIRONMENT=Production** en Netlify, con
un nuevo deploy. Cambia las credenciales solo si Tilopay entrega otras. Coordina
el cambio sin reservas en curso y resuelve antes los enlaces Test pendientes.

La variable NO cambia el modo real de la cuenta: ambos usan el mismo host.
[Entornos de Tilopay](https://tilopay.com/developers/entornos).

Antes de ventas reales, reemplaza las credenciales que se hayan compartido en el
chat o en capturas desde los servicios correspondientes y actualiza el archivo y
Netlify. El repositorio no puede emitir nuevas contraseñas de Gmail, claves de
Cloudflare o credenciales de Tilopay. Esto es independiente del cambio de modo.
