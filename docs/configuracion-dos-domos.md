# Reservas de ambos domos

Configuración acordada: **US$170 por noche por domo**, moneda USD, pago mediante
Tilopay y sitio actual `https://macasmoon-reservas-testing.netlify.app`.
Tilopay permanece en **Test** hasta que el propietario decida cambiarlo.
El diseño y los asuntos de correo son comerciales; una operación simulada conserva
la indicación «sin cargo real». No se presenta como dinero cobrado.

## 1. Añadir los calendarios privados del romántico

Abre **.env.netlify** y completa estas dos líneas que ya existen:

```dotenv
ICAL_DOMO_ROMANTICO_AIRBNB_URL=ENLACE_ICAL_EXPORTADO_POR_AIRBNB_DEL_ROMANTICO
ICAL_DOMO_ROMANTICO_EXPEDIA_URL=ENLACE_ICAL_EXPORTADO_POR_EXPEDIA_DEL_ROMANTICO
```

Sustituye únicamente lo que va después de `=` por cada enlace completo. Son los
enlaces privados que **exporta cada anuncio del romántico**, no las direcciones
de nuestra web. No copies los del amplio: cada domo es una unidad independiente.
No pegues estas direcciones privadas en el código ni las subas a Git.

Ya quedaron preparados estos valores en el archivo privado:

```dotenv
BOOKING_ACTIVE_DOMES=domo-romantico,domo-amplio
BOOKING_CURRENCY=USD
PRICE_DOMO_ROMANTICO_CENTS=17000
PRICE_DOMO_AMPLIO_CENTS=17000
NEXT_PUBLIC_BOOKING_TEST_MODE=false
TILOPAY_CHECKOUT_ENABLED=true
TILOPAY_EXPECTED_ENVIRONMENT=Test
```

`17000` son centavos: equivalen a US$170 por noche, no a US$17 000.
Dos noches cuestan US$340 por domo. El romántico admite hasta 2 huéspedes y el
amplio hasta 4. Si faltan calendarios o no se pueden leer, ese domo no permite
crear reservas ni pagos; el otro puede seguir funcionando.

## 2. Preparar y publicar una sola vez

### Comprobar en tu computadora, sin gastar deploys

En la terminal, dentro del proyecto, ejecuta:

```bash
npm run check:deploy
```

Revisa el archivo privado, ejecuta las pruebas automatizadas, lint, compilación,
tipos y auditoría de exposición. La compilación usa los valores de .env.netlify;
`npm run build` por sí solo no carga ese archivo. No realiza reservas, cobros,
envíos de correo ni consultas a la base real. Las pruebas usan una base desechable.
El aviso de que Netlify debe aportar la base es normal: no significa que esté fallando.

Opcionalmente, `npm run check:netlify-env -- --fetch` descarga los cuatro calendarios
para comprobar su respuesta, sin cambiar fechas ni mostrar enlaces privados.
Esto no comprueba que cada enlace pertenezca al anuncio correcto: debes comprobarlo
en la cuenta de cada plataforma.

### Importar las variables ANTES del push o del deploy

1. En Netlify abre el proyecto **macasmoon-reservas-testing**, no el de macasmoon.com.
2. Entra en **Project configuration → Environment variables**. Usa la opción de
   importar desde un archivo `.env` y selecciona **.env.netlify**. Si ofrece un cuadro
   para pegar el contenido, pega el archivo completo allí, no dentro del valor de
   una sola variable. No necesitas introducirlas una por una.
3. Si ya existen variables, actualiza sus valores con los del archivo actual;
   no conserves los antiguos. Revisa especialmente `BOOKING_ACTIVE_DOMES` con ambos
   domos, las dos tarifas `17000` y los cuatro enlaces iCal, incluidos los del romántico.
4. **Same value for all deploy contexts** significa «usar este mismo valor para
   todas las formas de publicar este proyecto». Puedes usarlo en este proyecto
   separado de pruebas. Si eliges valores por contexto, actualiza **Production**:
   es el contexto del sitio principal de este proyecto de pruebas, NO el modo
   Producción de Tilopay. Tilopay debe continuar en **Test**.
5. Las variables del servidor deben incluir el alcance **Functions**. Las que
   empiezan por `NEXT_PUBLIC_` también necesitan **Builds**, porque Next las incorpora
   al compilar. Mantener los alcances Builds y Functions del proyecto es válido.
6. Conserva como secretos las credenciales de Tilopay, contraseñas, hash del
   administrador, claves privadas y los cuatro enlaces iCal privados. **No marques
   todas las variables como secretas**: `SMTP_USER`, precios, indicadores y claves
   `NEXT_PUBLIC_` son públicos o de configuración. No desactives el escaneo de secretos.
7. No importes **.env.local**, no subas ninguno de estos dos archivos a Git y no
   sustituyas la conexión que Netlify proporciona automáticamente. No hace falta
   crear otra base ni volver a registrarte en ningún servicio.
8. Guarda los valores. Revisa que el proyecto publique la rama **feature/reservas**.
   Después revisa los cambios, haz commit y push cuando lo decidas. Si eso inicia el
   deploy automáticamente, espera a **Published** y no dispares otro manualmente.
   Si no hay cambios de código nuevos y solo actualizaste variables, vuelve a desplegar
   el último commit de esa rama una sola vez.

**El archivo .env.netlify no viaja con el push.** Guardar enlaces en tu computadora
y volver a desplegar sin importarlos no actualiza la configuración remota. Netlify
necesita un nuevo build/deploy después de guardar las variables.
[Variables e importación en Netlify](https://docs.netlify.com/build/environment-variables/get-started/),
[alcance Functions](https://docs.netlify.com/build/functions/environment-variables/).

La anulación administrativa añadida posteriormente sí necesita la migración
**0004_admin_cancellations.sql** antes de publicar. La revisión y resolución de
enlaces requiere también **0005_payment_link_resolution.sql**.
La preparación del cambio de Test a Producción añade **0006_payment_environment.sql**
para conservar el entorno histórico de cada pago. Consulta los pasos en
[Anular reservas y bloqueos](anular-reservas-y-bloqueos.md#migración-necesaria-antes-de-publicar).
No se ha cambiado el comercio a Producción ni se han realizado cobros por ti.
Las optimizaciones conservadoras y sus límites de ahorro se explican en
[Consumo de base de datos](consumo-base-datos.md); el respaldo de pagos y correos
permanece habilitado cada 15 minutos.

### Comprobar que quedó publicado lo correcto, sin otro deploy

```bash
npm run check:published
```

Compara las tarifas públicas del sitio actual con .env.netlify. Si el
romántico sigue deshabilitado o sigue el precio anterior, indica qué variable no
coincide. Cuando las tarifas coinciden, comprueba que los dos enlaces iCal respondan
200 y entreguen calendarios sin iniciar sesión. Esto consulta la base indirectamente
al exportar cada calendario, pero no cambia datos ni consulta información personal.
No verifica credenciales de pago ni garantiza que las plataformas ya hayan importado.
También puedes abrir `/api/pricing`: debe mostrar USD y ambos domos con `17000`.
No intentes pagar si este paso aún muestra diferencias.

Después revisa `/reservar?domo=domo-romantico` y `/reservar?domo=domo-amplio`:
ambos deben poder seleccionarse, mostrar calendario y calcular US$170 por noche.
En `/admin`, inicia sesión y comprueba el selector de los dos calendarios.
Para la prueba completa utiliza solo tarjetas de simulación autorizadas por Tilopay;
termina antes de que venza el bloqueo de 30 minutos. El resultado esperado es
**confirmada**, un correo al huésped y otro a los dueños, y las fechas en el iCal
del domo elegido. No repitas el pago si Tilopay lo aprobó pero la web no confirmó:
revisa la reserva y su incidencia desde el panel.

**Aunque Tilopay esté en Test, una reserva confirmada o bloqueo manual sí cierra
fechas de disponibilidad reales si estos feeds están conectados a anuncios reales.**
Escoge fechas autorizadas por los dueños y verifica su reapertura al terminar.
No elimines las conexiones iCal para intentar acelerar esa reapertura.

## 3. Enlaces de nuestra web para importar en Airbnb y Expedia

| Anuncio de destino | Enlace que debe importar |
| --- | --- |
| Domo amplio, tanto en Airbnb como en Expedia | `https://macasmoon-reservas-testing.netlify.app/api/calendar/domo-amplio/calendar.ics` |
| Domo romántico, tanto en Airbnb como en Expedia | `https://macasmoon-reservas-testing.netlify.app/api/calendar/domo-romantico/calendar.ics` |

Cada enlace exporta únicamente las reservas confirmadas y bloqueos manuales de su
domo, sin nombres, correos ni información de pago. No intercambies enlaces entre domos.
La información importada de Airbnb/Expedia no se vuelve a exportar desde nuestra web.
Estos dos enlaces permanecen disponibles aunque desactives nuevas reservas de un
domo: los cierres existentes deben seguir comunicándose. Un calendario sin reservas
devuelve un iCal válido vacío, no un error 404. Solo un domo desconocido devuelve 404;
si no se puede consultar la base devuelve 503, nunca un calendario vacío engañoso.

Si Airbnb o Expedia rechazan el enlace, ejecuta `npm run check:published` para
comprobar la configuración y abre el enlace `.ics` exacto: debe responder con
`BEGIN:VCALENDAR` y `END:VCALENDAR` (o descargarse como archivo). No pegues en esas
plataformas los enlaces privados que ellas mismas exportan: debes importar los
enlaces públicos de nuestra web indicados en la tabla, uno por domo. No requieren
iniciar sesión en `/admin`. Un 404 o 503 de una versión anterior no se arregla
cambiando el enlace: publica el código/configuración correctos antes de reintentar.

No desconectes y reconectes un calendario para forzar su actualización. Expedia
puede conservar cierres: antes de reabrir manualmente, comprueba que no exista otra
reserva válida. iCal mantiene su riesgo residual de retrasos y reservas simultáneas.

## 4. Panel del administrador

Entra en `/admin` con el usuario y contraseña ya configurados. En **Ver calendario de**
puedes elegir el amplio o el romántico. La lista de reservas, incidencias, fuentes
importadas y bloqueos corresponden al domo seleccionado. Al cambiar de domo se limpian
las fechas y selección anteriores. Cada uno mantiene su propio historial.

La sección **Sincronización** muestra el enlace iCal del domo seleccionado y permite
copiarlo. **Bloquear noches manualmente** actúa solo sobre ese domo y exige verificar
ambos calendarios. También puedes verificar pagos y reintentar correos pendientes.
El panel no realiza reembolsos ni cancela automáticamente pagos de Tilopay.
Usa un único botón **Liberar fechas** tanto para reservas como para bloqueos
manuales completos o parciales, con motivo y confirmación. El historial conserva
quién y cuándo lo hizo. Al pulsar un día ocupado del calendario administrador se
abre un cuadro con sus detalles privados y la misma acción **Liberar fechas**.
Pulsa **Mostrar historial** para consultar solicitudes vencidas y anulaciones;
no son cobros ni deudas por el mero hecho de aparecer ahí.
[Instrucciones y límites de las anulaciones](anular-reservas-y-bloqueos.md).

## 5. Antes de abrir ventas reales

El sitio actual sigue sin cobrar dinero real. Cuando decidas abrir ventas, configura
el modo de Producción en Tilopay y cambia `TILOPAY_EXPECTED_ENVIRONMENT=Production`.
Actualiza el dominio autorizado de Turnstile si cambias de dirección y verifica la
configuración con `npm run check:netlify-env -- --production` antes de publicar.
No mezcles registros de operaciones simuladas con la base de ventas reales sin
revisar y resolver previamente sus bloqueos e incidencias. El cambio de modo no
convierte pagos simulados en cobros reales.
