# Prueba de reservas e iCal: solo domo amplio

Esta prueba se hace en **otro sitio de Netlify**, sin conectar `macasmoon.com` ni activar cobros. Solo se habilita `domo-amplio`: el romántico sigue visible en el catálogo, pero no se puede reservar en este sitio de pruebas. No cambies su sincronización actual en Airbnb o Expedia.

## 1. Sitio y base de pruebas

1. Comprueba que estás en `feature/reservas` con `git branch --show-current`. No hagas merge en `main`.
2. Usa un proyecto de Netlify **separado** del que publica `macasmoon.com`, con su subdominio `*.netlify.app`. No conectes el dominio real.
3. En ese proyecto, abre **Data & Storage → Database → Create a database manually**. Comprueba antes el coste y la disponibilidad del servicio en tu plan. Netlify Database proporciona `NETLIFY_DB_URL` automáticamente; no la escribas tú. La migración [0001_create_reservations.sql](../netlify/database/migrations/0001_create_reservations.sql) crea las tablas durante el deploy; no pegues SQL a mano.

## 2. Variables: solo dos enlaces de entrada

Las variables son líneas `NOMBRE=valor`. El archivo local [`.env.netlify`](../.env.netlify) está **ignorado por Git**: no lo subas ni compartas sus enlaces o clave.

1. Abre `.env.netlify`. Debe incluir `BOOKING_ACTIVE_DOMES=domo-amplio`, el precio `PRICE_DOMO_AMPLIO_CENTS` y únicamente los dos enlaces iCal privados del **anuncio amplio**: `ICAL_DOMO_AMPLIO_AIRBNB_URL` y `ICAL_DOMO_AMPLIO_EXPEDIA_URL`. El precio es un entero en centavos de `BOOKING_CURRENCY`: `12500` equivale a USD 125 si la moneda es USD. Si ya configuraste `PRICE_DOMO_ROMANTICO_CENTS`, puedes conservarlo; por sí solo no habilita ese domo. No añadas enlaces iCal del romántico.
2. Cada enlace de entrada es el que **exporta** Airbnb o Expedia para su anuncio amplio. No pegues aquí el enlace `.ics` que publica nuestra web. No cruces anuncios, no añadas comillas ni espacios. Nunca compartas los enlaces privados ni `BOOKING_TEST_SECRET`.
3. Ejecuta `npm run check:netlify-env -- --fetch`. Debe validar el precio, el modo sin cobro y los **dos** calendarios iCal. Corrige cualquier error antes de desplegar.
4. En el **proyecto separado de pruebas** de Netlify, ve a **Project configuration → Environment variables → Add a variable → Import from a .env file**. Copia **todo el contenido** de `.env.netlify` y pégalo en el cuadro grande. No pegues todas las líneas en el campo `Value` de una sola variable ni subas este archivo a Git.
5. Si Netlify pregunta por **Scopes**, usa **All scopes** para que estén disponibles en build y Functions. `Same value for all deploy contexts` está bien **solo porque todo este proyecto es de pruebas**. Guarda la importación y comprueba que aparecen las variables por separado. Si ya existían, elige actualizar conflictos solo después de verificar que sigues en el proyecto correcto. Importar no elimina variables antiguas: si antes añadiste `ICAL_DOMO_ROMANTICO_*` en este proyecto, bórralas manualmente en Netlify. La protección `BOOKING_ACTIVE_DOMES=domo-amplio` impide usar ese domo aunque quedasen variables antiguas.

| Grupo | Variables necesarias |
| --- | --- |
| Alcance y precio | `BOOKING_ACTIVE_DOMES=domo-amplio`, `BOOKING_ENABLED=true`, `BOOKING_CURRENCY`, `PRICE_DOMO_AMPLIO_CENTS` |
| Prueba sin pago | `NEXT_PUBLIC_BOOKING_TEST_MODE=true`, `BOOKING_TEST_SECRET` |
| iCal de entrada | `ICAL_DOMO_AMPLIO_AIRBNB_URL`, `ICAL_DOMO_AMPLIO_EXPEDIA_URL` |
| Funciones apagadas | `TILOPAY_CHECKOUT_ENABLED=false`, `BOOKING_RECONCILE_ENABLED=false` |

Son **10 variables necesarias**; pueden ser 11 si conservaste el precio del romántico. `BOOKING_TEST_SECRET` no es un token de iCal: es la clave que introducirás en el formulario para confirmar reservas de prueba **sin pagar**. Netlify proporciona `URL`, `SITE_ID` y `NETLIFY_DB_URL`; no los copies en el archivo. Sin `RESEND_API_KEY` y `BOOKING_EMAIL_FROM`, la reserva se confirma pero no se envía correo.

## 3. Comprobar y desplegar una sola vez

Un `push` no incluye cambios sin commit. Si aún no quieres hacer commit, Netlify CLI puede desplegar archivos locales; las variables del paso 2 deben estar importadas primero.

1. Comprueba Node con `node --version` (Next 16 requiere al menos 20.9). Si faltan dependencias, ejecuta `npm ci`. Luego ejecuta:

       npm run typecheck
       npm run lint
       npm run build
       npm run check:netlify-env -- --fetch

2. Copia el **Project ID del sitio de pruebas** desde **Project configuration → General → Project information**. En este repositorio ejecuta:

       npx netlify-cli@latest login
       npx netlify-cli@latest link --id ID_DEL_SITIO_DE_PRUEBAS
       npx netlify-cli@latest build --context production

   `netlify build` comprueba localmente el build de Netlify y no publica la web. Antes de continuar, verifica que el ID corresponde al proyecto de pruebas.
3. Opcionalmente, para comprobar la base local, ejecuta `npx netlify-cli@latest dev` en una terminal y `npx netlify-cli@latest database migrations apply` en otra. La base de Netlify Dev es local y separada. En la URL local verifica `/api/availability/domo-amplio`, crea y cancela una reserva de prueba, y comprueba el `.ics`. El romántico debe responder 404. Termina Netlify Dev con Ctrl+C.
4. Cuando todo pase, publica **solo** el proyecto de pruebas:

       npx netlify-cli@latest deploy --prod --site ID_DEL_SITIO_DE_PRUEBAS --context production

   `--prod` publica en la URL principal del proyecto indicado por `--site`, que debe ser `*.netlify.app`, nunca `macasmoon.com`. La migración debería aplicarse durante el deploy. Verifica en **Data & Storage → Database → Database branches → View/edit** que existen `reservations` y `reservation_nights`; si faltan, revisa los logs y no crees reservas.

## 4. Prueba web antes de conectar los anuncios

Sustituye `SITIO` por el subdominio del proyecto de pruebas:

1. Abre `https://SITIO.netlify.app/api/availability/domo-amplio`: debe indicar `ready`. Si no, revisa base, migración y los dos enlaces iCal de entrada.
2. Abre `https://SITIO.netlify.app/api/calendar/domo-amplio/calendar.ics`: debe responder `BEGIN:VCALENDAR` y `text/calendar`. Al principio no tendrá eventos. **Este es el enlace de salida que más tarde importarás en Airbnb y Expedia del amplio**. El `.ics` del romántico debe responder 404.
3. En `/reservar`, comprueba que solo se puede elegir el domo amplio. Escoge noches futuras libres, completa datos de prueba e introduce `BOOKING_TEST_SECRET` en el campo del formulario. No habrá cobro. Guarda el ID o la URL de estado.
4. Verifica que la noche queda ocupada en la web y que el `.ics` del amplio contiene un `VEVENT`. Una segunda reserva para la misma noche debe ser rechazada.
5. Cancela desde la página de estado con la misma clave. Comprueba que desaparece el `VEVENT`. Si un feed de entrada sigue anunciando esa noche como ocupada, la web puede seguir mostrándola bloqueada.

El iCal de salida no lleva token ni datos personales; quien conozca su URL puede ver noches ocupadas. Los iCal de entrada de Airbnb y Expedia son privados.

## 5. Sincronización con Airbnb y Expedia del amplio

**Atención:** importar el feed de pruebas en anuncios reales hace que las reservas de prueba bloqueen noches reales. Acuerda con los dueños fechas del amplio para probar; no toques reservas de huéspedes ni la sincronización del romántico. Guarda la configuración previa para poder revertirla.

1. En los anuncios del **domo amplio** de Airbnb y Expedia/Partner Central, importa **el mismo enlace de salida**: `https://SITIO.netlify.app/api/calendar/domo-amplio/calendar.ics`. La web mantiene como entrada los dos enlaces privados que esos anuncios exportan.
2. Verifica que ambas plataformas aceptan el enlace público HTTPS. Si habías importado una antigua URL de salida con token, sustitúyela: la ruta antigua responde 404.
3. Crea una reserva de prueba del amplio en la web. Aparecerá inmediatamente en el `.ics`; observa cuándo Airbnb y Expedia vuelven a consultarlo y bloquean las noches. Anota las horas.
4. Cancela desde la página de estado y espera la siguiente importación en cada plataforma antes de concluir que se liberaron las noches.
5. Prueba el sentido inverso con un bloqueo propio y reversible en un anuncio **del amplio** y comprueba que aparece en la web.

iCal funciona mediante consultas periódicas. **No garantiza actualización instantánea ni elimina por completo el riesgo de reservas dobles entre plataformas.** Esta prueba sirve para medir los retrasos reales. Si el riesgo no es aceptable, no actives el cobro automático con iCal.

## Después de probar

Cancela las reservas de prueba y verifica que las noches se liberaron en Airbnb y Expedia. Si el feed de pruebas no se usará permanentemente, quítalo de ambos anuncios del amplio después de comprobar la liberación. Mantén Tilopay desactivado en la web pública hasta probar aparte pagos, correo y conflictos.

Referencias: [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/), [migraciones](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/), [variables automáticas de Netlify](https://docs.netlify.com/build/functions/environment-variables/), [Netlify CLI](https://cli.netlify.com/commands/deploy/), [calendarios de Airbnb](https://www.airbnb.com/help/article/99).
