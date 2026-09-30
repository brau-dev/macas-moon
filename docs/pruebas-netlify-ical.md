# Prueba de reservas e iCal en un Netlify separado

Esta guía publica esta copia de trabajo, sin commit y sin modificar macasmoon.com. No actives el cobro real en esta prueba. Consulta también [reservas-directas-ical-tilopay.md](reservas-directas-ical-tilopay.md).

**Qué hace cada parte:** el sitio de Netlify muestra la página y ejecuta sus funciones; Netlify Database guarda las reservas; los enlaces iCal intercambian noches ocupadas con Airbnb y Expedia. Crear la base no publica la web ni conecta los calendarios por sí solo.

## 1. Sitio y base de datos de pruebas

1. Comprueba la rama con `git branch --show-current`; no hagas merge en main.
2. Crea otro proyecto de Netlify sin asociarle macasmoon.com ni el proyecto que publica la web. Usa un subdominio estable como https://macas-moon-pruebas.netlify.app. Copia el **Project ID** de Project configuration → General → Project information.
3. En **ese mismo proyecto de pruebas**, entra en **Data & Storage → Database → Create a database manually**. Es una base PostgreSQL integrada en Netlify; **no necesitas cuenta en Neon, instalar PostgreSQL ni copiar una cadena de conexión**. Comprueba primero que tu plan permite Netlify Database y revisa su consumo de créditos. La aplicación usa automáticamente la variable privada `NETLIFY_DB_URL` que aporta Netlify. En el siguiente deploy, la migración [0001_create_reservations.sql](../netlify/database/migrations/0001_create_reservations.sql) crea las tablas `reservations` y `reservation_nights`. **No pegues el SQL a mano**.
4. En **Project configuration → Environment variables** del proyecto de pruebas, crea cada variable de la tabla siguiente con su valor. Si Netlify ofrece scopes, selecciona **All scopes** para esta prueba; así las variables necesarias estarán tanto en el build como en las funciones. Tras cambiarlas, vuelve a desplegar. No copies todo .env.local ni publiques secretos. **No crees `DATABASE_URL`, `NETLIFY_DB_URL` ni `SITE_ID`: Netlify proporciona las dos últimas automáticamente**.

| Variable | Valor |
| --- | --- |
| NEXT_PUBLIC_SITE_URL, BOOKING_SITE_URL | URL HTTPS exacta del nuevo sitio |
| BOOKING_ENABLED | true |
| BOOKING_CURRENCY | USD o moneda acordada |
| PRICE_DOMO_ROMANTICO_CENTS, PRICE_DOMO_AMPLIO_CENTS | Tarifas positivas en centavos; se muestran pero no se cobran con la clave de prueba |
| NEXT_PUBLIC_BOOKING_TEST_MODE, BOOKING_TEST_MODE | true |
| BOOKING_TEST_SECRET | Nueva clave de al menos 24 caracteres [A-Za-z0-9_-], por ejemplo generada con openssl rand -hex 32 |
| BOOKING_TEST_SITE_URL | La misma URL HTTPS *.netlify.app |
| BOOKING_TEST_SITE_ID | Project ID del nuevo proyecto |
| TILOPAY_CHECKOUT_ENABLED, BOOKING_RECONCILE_ENABLED | false |
| ICAL_DOMO_ROMANTICO_AIRBNB_URL, ICAL_DOMO_ROMANTICO_EXPEDIA_URL, ICAL_DOMO_AMPLIO_AIRBNB_URL, ICAL_DOMO_AMPLIO_EXPEDIA_URL | Enlaces privados que exportan los cuatro anuncios, emparejados con el domo correcto |
| ICAL_EXPORT_ROMANTICO_TOKEN, ICAL_EXPORT_AMPLIO_TOKEN | Genera dos tokens de salida nuevos y distintos de al menos 24 caracteres [A-Za-z0-9_-], uno por domo, por ejemplo con openssl rand -hex 32 ejecutado dos veces |

Si en .env.local aún tienes ICAL_*_BOOKING_URL, cambia el nombre a ICAL_*_EXPEDIA_URL **sólo si su valor realmente es un enlace de Expedia**. Los enlaces de Booking.com no sustituyen los de Expedia. BOOKING_TEST_SECRET debe ser distinto de los dos tokens de calendario.

RESEND_API_KEY, BOOKING_EMAIL_FROM y BOOKING_REPLY_TO son opcionales en la prueba: sin ellos la reserva se confirma, pero no llega el correo. Si activas Resend, usa un remitente verificado y tu propio correo. No necesitas Tilopay ni Turnstile para una reserva sin pago.

## 2. Publicar archivos locales sin commit

La integración Git de Netlify no ve cambios locales sin commit. Usa Netlify CLI desde este repositorio y apunta explícitamente al **Project ID de pruebas**:

    node --version
    npm install
    npm run typecheck
    npm run lint
    npx netlify-cli@latest login
    npx netlify-cli@latest deploy --prod --site ID_DEL_SITIO_DE_PRUEBAS --context production

El deploy construye los archivos locales; no requiere commit. La opción --prod publica en la URL principal **del sitio indicado por --site**: verifica ese ID antes de ejecutarla. Nunca uses el ID del proyecto que atiende macasmoon.com. Node debe ser compatible con Next 16 (al menos 20.9). El build en Netlify usa Node 20 según netlify.toml. **La migración de Netlify Database debe crear las tablas antes de publicar el deploy**; si falla, consulta los logs del deploy y no intentes crear reservas todavía.

No conectes macasmoon.com a este sitio. El modo de prueba sólo se autoriza si coinciden la URL HTTPS *.netlify.app y el Project ID, además de la clave. robots.txt solicita no indexar el sitio mientras BOOKING_TEST_MODE=true.

Una vez publicado, en **Data & Storage → Database → Database branches → View/edit**, deben aparecer `reservations` y `reservation_nights`. La base empieza vacía; aparecerá una fila en `reservations` después de tu primera reserva de prueba.

## 3. Comprobar la web antes de conectar feeds a anuncios

1. Abre https://SITIO.netlify.app/api/availability/domo-romantico y el mismo endpoint para domo-amplio. Ambos deben devolver status ready. Si devuelven error, revisa los cuatro iCal de entrada, que la base esté creada y que la migración haya finalizado.
2. Abre https://SITIO.netlify.app/api/calendar/domo-romantico/TOKEN_ROMANTICO/calendar.ics y el equivalente de domo-amplio. Deben responder HTTP 200 con BEGIN:VCALENDAR y tipo text/calendar. Un token erróneo da 404.
3. En /reservar, elige noches futuras libres, completa datos de prueba y pega BOOKING_TEST_SECRET **sólo en el formulario**. Debe confirmarse sin ir a Tilopay. Guarda la URL de estado y el ID.
4. Comprueba que esas noches aparecen ocupadas en la web y que el feed .ics contiene un VEVENT; DTSTART es llegada y DTEND es salida exclusiva. Otra reserva de la misma noche debe ser rechazada.
5. En la pantalla de estado, introduce la clave para cancelar la reserva de prueba. Verifica que desaparece del feed. Puede seguir apareciendo ocupada en la web si algún iCal de entrada aún refleja el bloqueo.

## 4. Comprobar Airbnb y Expedia

**Atención:** importar el feed de prueba en anuncios reales hará que una reserva de prueba confirmada bloquee noches reales. Acuerda con los dueños qué domo y fechas futuras usar; evita noches con huéspedes o alta probabilidad de venta. Haz un domo a la vez y conserva los enlaces anteriores para poder revertirlos.

1. En el anuncio correspondiente de Airbnb y Expedia/Partner Central, importa el .ics **de salida del mismo domo**. Mantén en la web los iCal **de entrada** de cada plataforma. No cruces domos.
2. Verifica que la plataforma importa la URL. Si falla, comprueba HTTPS, extensión .ics, token correcto y HTTP 200 desde un navegador sin iniciar sesión.
3. Crea la reserva de prueba en la web. Debe aparecer inmediatamente en el .ics; espera a que cada plataforma importe el feed y verifica el bloqueo en Airbnb y Expedia. Anota hora de reserva y hora observada en cada plataforma.
4. Cancela desde la pantalla de estado. Debe desaparecer de inmediato del .ics; espera la siguiente importación de cada plataforma para ver la liberación. Si Airbnb o Expedia todavía exportan el bloqueo anterior, la web puede seguir mostrándolo como ocupado: no fuerces otra reserva superpuesta.
5. Repite con el otro domo. Comprueba el sentido inverso usando un bloqueo propio y reversible en una plataforma y esperando a que aparezca en la web. No canceles reservas reales.

iCal se consulta periódicamente: **no garantiza sincronización inmediata ni ausencia total de dobles reservas entre canales**. Esta prueba mide el retraso real de estos anuncios. Si el riesgo resulta inaceptable, no habilites cobros automáticos con iCal.

## Después de probar

Cancela todas las reservas de prueba, verifica que las noches se liberaron en Airbnb y Expedia y elimina de los anuncios el feed de pruebas si no se usará permanentemente. No elimines la base ni los tokens antes de verificar la liberación. Mantén TILOPAY_CHECKOUT_ENABLED=false en la web pública hasta probar por separado pagos, correo y conflictos.

Referencias: [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/), [migraciones automáticas](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/), [Netlify CLI deploy](https://cli.netlify.com/commands/deploy/), [Netlify Functions y variables](https://docs.netlify.com/build/functions/environment-variables/), [Netlify funciones programadas](https://docs.netlify.com/build/functions/scheduled-functions/), [Airbnb importar calendarios](https://www.airbnb.com/help/article/99).
