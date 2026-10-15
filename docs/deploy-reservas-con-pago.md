# Primer deploy de pruebas: Gmail + Tilopay

Usa solo el proyecto **macasmoon-reservas-testing**, nunca el sitio de macasmoon.com.
Se mantienen **US$0,01 por noche**, pago obligatorio y Tilopay **Test**.
No se han hecho commits, pushes, deploys ni cobros por ti.

## 1. Qué falta

Abre .env.netlify. Este archivo es privado: no lo subas a Git ni lo pegues en el chat.

| Dato | Qué hacer |
| --- | --- |
| Credenciales Tilopay | Ya escritas. No necesitas volver a registrarte. |
| SMTP_USER | Ya está macasmoonglamping@gmail.com, confirmado por ti. |
| SMTP_PASSWORD | Ya incorporada en el archivo privado; Gmail aceptó la autenticación SMTP. |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY y TURNSTILE_SECRET_KEY | Deben contener las claves del widget de pruebas; paso 3 si necesitas configurarlas. |
| ADMIN_USERNAME | Ya está escrito. Será el usuario del panel. |
| ADMIN_PASSWORD_HASH | Debe contener el hash generado en el paso 4. Si el validador ya lo acepta, no lo regeneres para corregir el pago. |
| BOOKING_RECONCILE_SECRET | Ya generada y guardada. No la cambies ni la compartas. |

El amplio ya tiene sus enlaces iCal. Puedes probar primero solo ese domo.
No necesitas Resend ni comprar un correo con dominio propio.

## 2. Autorizar Gmail

Ya está configurado y se verificó la autenticación. Estos pasos quedan para sustituir o
rotar la contraseña. No necesitas repetirlos para la clave actual.

1. Inicia sesión en Google con **macasmoonglamping@gmail.com**.
2. Activa la **verificación en dos pasos**, si aún no la tienes.
3. Abre [Contraseñas de aplicación](https://myaccount.google.com/apppasswords).
4. Crea una llamada Macas Moon reservas.
5. Copia la contraseña generada en SMTP_PASSWORD= de .env.netlify. Son 16 caracteres;
   el código admite los espacios con que Google suele mostrarlos. **No uses tu contraseña normal**.
6. Ejecuta en la terminal del proyecto:

~~~bash
npm run check:smtp
~~~

Esto comprueba acceso a Gmail, pero **no envía correos** ni modifica reservas.
No comprueba todavía la conexión desde Netlify. Si la opción de contraseña no aparece,
revisa [las restricciones de Google](https://support.google.com/accounts/answer/185833?hl=es).

El código ya configura host, puerto y cifrado. Los mensajes salen como **Macas Moon Glampings** desde
ese Gmail. El huésped recibe una confirmación profesional con HTML y texto alternativo,
referencia, domo, llegada, salida, noches, huéspedes, importe y estado del pago. Sus respuestas
llegan al Gmail del negocio; BOOKING_REPLY_TO es opcional para otra dirección.

Los dueños reciben **otro correo independiente en macasmoonglamping@gmail.com** con nombre,
correo, teléfono, país, detalles de estancia y pago, ID, referencia y acceso al panel.
Responder a ese aviso permite contactar al huésped. Solo se envían cuando se confirma la reserva,
no al empezar el pago, rechazarlo o crear un bloqueo manual. Ambos indican PRUEBA cuando corresponde.
La migración no genera avisos nuevos a los dueños por reservas históricas.

Si falla un envío después de pagar, **la reserva sigue confirmada**. El panel muestra por separado
el correo del huésped y el aviso de los dueños; Reintentar correos pendientes y el respaldo
programado reintentan solo los pendientes, sin repetir los ya registrados.
SMTP no garantiza entrega exactamente una vez: un fallo justo después
de entregar puede ocasionar un duplicado al reintentar. El correo no es factura fiscal.

## 3. Completar la protección contra robots

Es independiente de Gmail y Tilopay. Evita solicitudes automáticas que bloqueen noches sin pagar.
El código la exige antes del pago; no se ha desactivado.

1. Entra en [Cloudflare](https://dash.cloudflare.com/) y abre **Turnstile → Add widget**.
2. Nombre: Macas Moon pruebas.
3. Hostname: macasmoon-reservas-testing.netlify.app, sin https:// ni rutas.
4. Modo: **Managed**. Guarda con **Create**.
5. Copia **Site key** a NEXT_PUBLIC_TURNSTILE_SITE_KEY.
6. Copia **Secret key** a TURNSTILE_SECRET_KEY.

No cambies los DNS ni muevas el dominio a Cloudflare.
[Instrucciones oficiales](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/).

## 4. Preparar la contraseña del administrador

Ejecuta:

~~~bash
npm run admin:password
~~~

Escribe una contraseña nueva de al menos 12 caracteres y repítela.
La terminal no muestra lo que escribes: es normal.

Copia la línea completa ADMIN_PASSWORD_HASH=scrypt:... que imprime el comando y sustituye
la línea del mismo nombre en .env.netlify. No añadas otra duplicada.
Con ADMIN_USERNAME y **tu contraseña original** entrarás a /admin, no con el hash.

## 5. Revisar antes de gastar un deploy

### Corrección del error al abrir Tilopay (14 de octubre de 2026)

Se comprobó que el API genera el enlace de US$0,01, pero devuelve un enlace de
`https://tilo.co`. El filtro anterior solo aceptaba subdominios de `tilopay.com`:
rechazaba un enlace legítimo y respondía con error 500 antes de redirigir.
La lista segura ahora admite exactamente `tilo.co`, `app.tilopay.com` y
`admin.tilopay.com`, siempre con HTTPS y sin usuario, contraseña ni puerto alternativo.
`tilo.co` está documentado por el [soporte oficial de Tilopay](https://support.tilopay.com/portal/es/kb/articles/crear-un-link-de-pago).

No hay que cambiar claves, tarifas, iCal ni migraciones por esta corrección.
La pantalla de pago se abre **en la misma pestaña**, no en una ventana emergente.
Si falla otra etapa, el formulario muestra una referencia de soporte que permite
encontrar `Reservation failed` en los registros. Ese registro incluye etapa y motivo
controlados, nunca claves, enlaces privados, datos del huésped ni el cuerpo del proveedor.
No se reintenta automáticamente crear enlaces tras un fallo de red.

### Comprobaciones locales

Con Node 24 y dependencias instaladas, ejecuta:

~~~bash
npm run check:netlify-env
npm test
npm run typecheck
npm run lint
npm run build
~~~

El primer comando debe dejar de mostrar errores. No comprueba que Tilopay acepte las claves.
Los tests simulan pagos, SMTP y una base temporal: no cobran ni utilizan la base remota.
Puedes ejecutar npm run audit:exposure -- --history para revisar posibles secretos sin mostrarlos.

Para ver interfaces, ejecuta npm run dev y abre /reservar y /admin/login en localhost:3000.
Next lee .env.local, **no .env.netlify**: copia allí las variables de pruebas necesarias
sin borrar las existentes. Sin base/iCal no se habilitan reservas.
El pago completo necesita el retorno público y avisos de Tilopay: pruébalo en Netlify.

## 6. Importar variables y publicar una vez

1. En Netlify selecciona **macasmoon-reservas-testing**, conectado a feature/reservas.
2. Abre **Project configuration → Environment variables → Add a variable → Import from a .env file**.
3. Pega **todo el contenido de .env.netlify en la pantalla de importación**. No en Value
   de una única variable. Actualiza conflictos solo tras verificar el proyecto.
4. **Same value for all deploy contexts** es aceptable en este proyecto aislado de pruebas.
   No copia claves al sitio principal. Nunca compartas credenciales reales con previews.
5. Si puedes elegir alcances, las credenciales privadas necesitan **Functions**. Las variables
   NEXT_PUBLIC_* y los indicadores/tarifas necesitan **Builds y Functions**.
   All scopes funciona, pero da acceso también al proceso de build.
   Marca como secretos la contraseña SMTP, credenciales Tilopay, clave privada Turnstile,
   hash admin y clave interna. No marques como secreta la clave pública del widget.
6. No inventes ni sobrescribas URL, SITE_ID o NETLIFY_DB_URL: Netlify las proporciona.
7. Tras revisar y autorizar tus cambios, publica esta rama en ese proyecto, **sin merge a main**.
   .env.netlify nunca va en un commit. Git no incluye archivos locales sin commit.
   El [procedimiento CLI alternativo](pruebas-netlify-ical.md) permite desplegar archivos locales;
   conserva los indicadores de pago de esta guía, no los del modo gratuito.
8. El deploy debe aplicar las migraciones de netlify/database/migrations: 0001, 0002 y 0003.
   Solo se aplican las pendientes. La tercera registra por separado el aviso de los dueños.
   No borres tablas ni datos.
9. Abre /admin e inicia sesión. No deben aparecer avisos de configuración pendiente.

Netlify usa Node 24. Si existe un override manual AWS_LAMBDA_JS_RUNTIME antiguo, debe
actualizarse a nodejs24.x o quitarse para seguir el runtime del build. No desactives
el escaneo de secretos ni publiques claves con prefijo NEXT_PUBLIC_.

## 7. Probar un pago de Tilopay, paso por paso

Ya confirmaste el modo de pruebas del comercio. Mantén TILOPAY_EXPECTED_ENVIRONMENT=Test,
TILOPAY_CHECKOUT_ENABLED=true y NEXT_PUBLIC_BOOKING_TEST_MODE=false.
**Nuestra variable Test no cambia el modo del comercio. No uses tarjetas reales.**

1. Abre https://macasmoon-reservas-testing.netlify.app/reservar.
2. Elige una noche futura libre acordada con los dueños. Del 10 al 11 es **una noche**.
   Si los anuncios importan el feed de pruebas, la reserva bloqueará noches reales allí.
3. Escribe nombre, correo receptor, teléfono, país y huéspedes; completa la verificación.
4. Pulsa **Continuar al pago seguro**. Debe abrir una página HTTPS de Tilopay.
   Una noche cuesta USD 0,01. Si el comercio rechaza ese mínimo, no aumentes el precio sin decidirlo.
5. En Tilopay utiliza una de estas **tarjetas ficticias oficiales**:

   | Resultado | Número |
   | --- | --- |
   | Aprobado sencillo | 4111111111111111 |
   | Rechazado | 4012000000020121 |
   | Aprobado con autenticación 3DS | 4012000000020071 |

   Vencimiento futuro, por ejemplo **12/2030**. CVV: **123**.
   En la prueba 3DS introduce **3ds2** en su pantalla de autenticación.
   [Tarjetas y reglas oficiales](https://tilopay.com/developers/tarjetas-de-prueba).
6. Completa el pago y guarda la URL/ID de reserva al volver. Debe pasar a **Confirmada**
   después de la comprobación del servidor, no por mostrar un mensaje en Tilopay.
7. Revisa el correo receptor (también spam), el aviso en el Gmail de los dueños, /admin y el iCal del amplio.
   El mensaje dirá **PRUEBA**: no acredita un cobro real. Del 10 al 11 se bloquea solo la noche del 10.
8. Prueba rechazo y abandono en **otras fechas libres**. No deben confirmarse ni exportarse.
   El bloqueo pendiente es solo local y vence a los 30 minutos. No necesitas otro deploy.

**Si Tilopay aprueba pero la web sigue pendiente:** usa Verificar pago en /admin.
No repitas el pago. Si no se confirma, conserva el ID y describe el error sin claves
ni datos de tarjeta. La respuesta real de pagos asociados al enlace debe comprobarse
en esta primera integración: el código no confirma si no puede validarla.

**Correo pendiente:** revisa SMTP_PASSWORD, posibles alertas de Google y usa Reintentar correos pendientes
en el panel. Una conexión local puede ser rechazada desde un servidor nuevo.
No es un fallo de pago ni debe cobrarse de nuevo.

## 8. Calendarios y límites de la prueba

El enlace de salida del amplio no cambia:
https://macasmoon-reservas-testing.netlify.app/api/calendar/domo-amplio/calendar.ics.
No incluye huéspedes ni claves. No desconectes/reconectes calendarios para actualizar.

Para añadir el romántico, completa sus propios ICAL_DOMO_ROMANTICO_AIRBNB_URL e
ICAL_DOMO_ROMANTICO_EXPEDIA_URL y cambia BOOKING_ACTIVE_DOMES=domo-romantico,domo-amplio.
Valida antes del deploy. Cada domo tiene un feed distinto: no intercambies enlaces.

El panel quita bloqueos manuales y cancela pruebas **gratuitas**. No incluye cancelación/
reembolso automático de reservas Tilopay, tampoco las de Test. Coordina su limpieza antes
de aprobar una prueba si ese feed ya está importado en anuncios reales; no elijas fechas
que necesites liberar inmediatamente. No borres reservas directamente.

Expedia puede conservar cierres después de retirar un evento. Comprueba que no haya otra
reserva válida y reabre manualmente solo esas noches/unidad. iCal no elimina el riesgo residual
de reservas dobles. La conciliación cada 15 minutos es respaldo de pagos/correo, no obliga
a Airbnb/Expedia a actualizarse y puede consumir base incluso sin trabajo pendiente.
Más detalles: [panel-admin-y-pagos.md](panel-admin-y-pagos.md).
