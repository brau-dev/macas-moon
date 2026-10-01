# Reservas directas: iCal + Tilopay

Esta rama implementa el formulario de reserva directa sin WhatsApp. No se ha publicado ni configurado una cuenta real. La página activa permanece intacta hasta que se revise, configure y despliegue esta rama por separado. **Primera prueba Netlify:** solo `domo-amplio`; configura `BOOKING_ACTIVE_DOMES=domo-amplio` y usa únicamente sus dos iCal de entrada. Los pasos para ambos domos de este documento describen la configuración futura; sigue [la guía de pruebas](pruebas-netlify-ical.md) para el despliegue actual.

## Flujo

1. La web importa los iCal de Airbnb y Expedia por domo y combina sus noches ocupadas con reservas y bloqueos temporales de la base de datos.
2. El cliente elige domo y noches, ve el precio final, escribe nombre, correo, teléfono y dirección de facturación.
3. El servidor vuelve a leer disponibilidad y crea en PostgreSQL un bloqueo temporal de 30 minutos. La restricción `UNIQUE (dome, night)` impide que dos reservas **de esta web** tomen la misma noche.
4. En el flujo real, el cliente es redirigido a la página alojada de Tilopay. El retorno del navegador **no** confirma nada: el servidor llama a `consult`, compara referencia, importe, moneda, estado de captura y entorno. También hay endpoint de webhook y conciliación cada 2 minutos en Netlify.
5. Sólo una reserva confirmada aparece en el iCal exportado por la web y genera correo de confirmación. Un bloqueo temporal sí impide otra reserva en esta web, pero **no** se exporta a Airbnb/Expedia hasta pagar.

La confirmación enviada por correo es un comprobante de reserva, **no** una factura electrónica tributaria. La facturación fiscal, los impuestos, cargos, reglas de cancelación, reembolsos y el tratamiento de pagos aprobados después de vencer el bloqueo deben definirse antes de habilitar cobros reales.

## Configuración local

1. Usar Node.js compatible con Next 16 (al menos 20.9; preferible versión LTS reciente) y ejecutar `npm install`.
2. Preparar PostgreSQL local o gestionado. Ejecutar `db/001_reservations.sql` con el editor SQL del proveedor o `psql "$DATABASE_URL" -f db/001_reservations.sql`.
3. Copiar las variables de `.env.example` a `.env.local` **sin subir ese archivo a Git**. Configurar `DATABASE_URL`, los cuatro iCal de Airbnb/Expedia, `BOOKING_CURRENCY`, ambas tarifas finales y `BOOKING_ENABLED=true`. Si aún hay variables `ICAL_*_BOOKING_URL`, cambiarlas por `ICAL_*_EXPEDIA_URL` en `.env.local`.
4. Para pruebas sin dinero: `NEXT_PUBLIC_BOOKING_TEST_MODE=true` y un valor largo aleatorio para `BOOKING_TEST_SECRET`. Ejecutar `npm run dev`, abrir `/reservar`, elegir noches libres y completar el campo de clave de prueba. El servidor permite esta vía en localhost durante `npm run dev` o en un **sitio Netlify de pruebas separado** cuya URL `*.netlify.app` Netlify suministra automáticamente. No configures URL ni ID a mano. Consulta [pruebas-netlify-ical.md](pruebas-netlify-ical.md).
5. Abrir `/reservar/estado?id=<ID>` para comprobar confirmación. Revisar `/api/availability/<domo>`: debe devolver las noches como ocupadas. Revisar el iCal en `/api/calendar/<domo>/calendar.ics`; no hace falta generar tokens de salida. En esa misma pantalla, ingresar de nuevo la clave de prueba para **cancelarla y liberar las noches**; comprobar que desaparece del iCal de salida.
6. Para correo de prueba, configurar `RESEND_API_KEY` y un remitente verificado en `BOOKING_EMAIL_FROM`; de lo contrario la reserva se confirma, pero el estado mostrará que el correo está pendiente.

Un `localhost` no es accesible desde Airbnb o Expedia. Para comprobar allí el bloqueo de una reserva de prueba, ambas plataformas deben importar la URL **HTTPS pública** del iCal de la misma instancia/base de datos que recibe la reserva. Para las pruebas de esta rama, usa el sitio Netlify aislado descrito en [pruebas-netlify-ical.md](pruebas-netlify-ical.md). La importación iCal por las plataformas sigue siendo periódica, incluso si la web responde de inmediato; aceptar ese riesgo residual no lo elimina.

## iCal de salida

Cada anuncio de Airbnb y Expedia debe importar el feed correspondiente a su domo:

- `https://<sitio-de-pruebas>.netlify.app/api/calendar/domo-romantico/calendar.ics`
- `https://<sitio-de-pruebas>.netlify.app/api/calendar/domo-amplio/calendar.ics`

No confundir estos enlaces con los iCal **de entrada** que exportan Airbnb/Expedia. Los feeds de salida son públicos: cualquiera con la URL puede ver las noches ocupadas. Los eventos dicen sólo “No disponible”; no incluyen datos personales. La única clave de prueba es `BOOKING_TEST_SECRET`, que autoriza reservar sin pagar y nunca va en una URL de calendario. Una reserva de prueba confirmada también se exporta. Puede cancelarse desde su pantalla de estado en desarrollo o en el sitio Netlify de pruebas aislado, siempre con la clave de prueba.

## Tilopay y correo en producción

- Crear/habilitar una cuenta de comercio Tilopay y obtener usuario API, contraseña, key y merchant ID. Confirmar en la cuenta que el checkout alojado acepta Apple Pay y Google Pay; la disponibilidad depende del comercio y dispositivo del cliente.
- Netlify proporciona automáticamente la URL HTTPS del sitio para el retorno `/api/reservations/return/<id>`; no se configura `BOOKING_SITE_URL`. Configurar la cuenta de Tilopay en pruebas y `TILOPAY_EXPECTED_ENVIRONMENT=Test`. Tilopay **comparte host** para pruebas y producción: verificar el modo en el portal antes de probar para no cargar una tarjeta real. Mantener `TILOPAY_CHECKOUT_ENABLED=false` hasta entonces.
- Pedir a Tilopay el contrato del webhook de `processPayment` y el algoritmo de `orderHash`; registrar `/api/reservations/webhook`. El endpoint no confía en el cuerpo del webhook: consulta la transacción de todos modos. Si el contrato real no envía `orderNumber`/`order`, adaptar el parser antes de activar.
- Configurar un dominio remitente en Resend con los DNS que indique ese proveedor y `RESEND_API_KEY`, `BOOKING_EMAIL_FROM`, `BOOKING_REPLY_TO`.
- Crear un widget Cloudflare Turnstile para el dominio público, configurar `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY`. La ruta de cobro real valida el token contra Cloudflare antes de reservar noches; el modo de prueba local con clave no lo requiere.
- Cuando se habiliten cobros reales, configurar `BOOKING_RECONCILE_SECRET` y `BOOKING_RECONCILE_ENABLED=true` para la función programada de Netlify. En pruebas sin pago, mantenerla deshabilitada. Las funciones programadas sólo corren automáticamente en el deploy publicado; en deploy previews y local se prueban manualmente.
- Confirmar con los dueños precio final por domo, moneda, impuestos y tarifas, política de cancelación/reembolso, datos de facturación exigidos y quién atiende incidentes de pagos tardíos o calendarios discrepantes.

## Límite de seguridad operacional

La base de datos evita dobles reservas **entre clientes de esta web**. iCal no ofrece transacciones ni bloqueo instantáneo en Airbnb/Expedia: esos canales pueden aceptar una reserva mientras el pago directo está en curso o antes de importar el feed. Esto es el riesgo residual aceptado, no una garantía de cero cruces. Si un pago se aprueba después de vencer el bloqueo, la reserva no se confirma automáticamente; aparece un error para gestión inmediata y posible reembolso. Antes de activar pagos reales, configurar alertas para errores de conciliación, correo y conflictos, además de supervisar el control Turnstile contra abuso de bloqueos temporales.

Referencias oficiales: [Tilopay Hosted payment page](https://tilopay.com/developers/api/hosted-payment-page/process-payment), [Tilopay consult](https://tilopay.com/developers/api/procesos-operativos/consult), [Tilopay entornos](https://tilopay.com/developers/entornos), [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/), [Resend Node.js](https://resend.com/nodejs), [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).
