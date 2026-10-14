# Panel privado, pagos y operación con iCal

**Configuración actual con pago obligatorio:** sigue primero
[deploy-reservas-con-pago.md](deploy-reservas-con-pago.md). `.env.netlify` tiene la vía gratuita
apagada, Tilopay activado en configuración y entorno esperado Test, pero faltan credenciales.
No se pueden realizar cobros hasta completar y verificar esa cuenta. La sección 3 de este
documento explica la alternativa gratuita, no el modo actualmente seleccionado.

Se mantiene iCal para Airbnb y Expedia. El acceso elegido es `/admin` en la misma web,
sin enlaces en la navegación pública. La dirección no es un secreto: la protección real
es la sesión autenticada, comprobada también en cada API privada.

## Funciones del panel

- Calendario mensual por domo, con colores para reservas web, pagos pendientes, bloqueos
  manuales y noches importadas de Airbnb/Expedia.
- Datos de huéspedes de las reservas web: nombre, correo, teléfono, país y cantidad de personas.
  iCal no permite obtener todos los detalles de huéspedes de los otros canales.
- Crear y quitar bloqueos manuales con motivo privado; cancelar reservas de prueba.
- Verificar pagos y reintentar correos; ver incidentes de pagos tardíos.

No se añade cancelación/reembolso automático de reservas pagadas: sus condiciones financieras
y el procedimiento deben acordarse con los dueños. No se confirman automáticamente pagos
aprobados después de vencer el bloqueo de sus noches.

## 1. Actualizar la base sin borrar datos

La migración 002 añade campos a `reservations` y crea `admin_sessions` y `admin_login_limits`.
La 003 registra el aviso de los dueños por separado; no genera avisos retrospectivos de reservas existentes.
Conserva las reservas existentes y sus antiguos datos de facturación.

- **Netlify Database:** el deploy debe aplicar las migraciones de `netlify/database/migrations`.
  Comprueba el registro del deploy y que existen las dos tablas nuevas antes de entrar al panel.
- **PostgreSQL local o externo:** en una base nueva aplica primero `db/001_reservations.sql`.
  Luego aplica `db/002_admin_and_payment_links.sql` y `db/003_owner_notifications.sql` con el editor SQL de tu proveedor o `psql`.
  En una base existente, aplica solo las migraciones pendientes.

Las pruebas ficticias deben usar una base distinta de producción.

## 2. Crear el usuario y la contraseña

No hay credenciales predeterminadas. Elige el usuario y una contraseña que solo conozcan
las personas autorizadas. En la terminal del proyecto ejecuta:

```bash
npm run admin:password
```

Escribe la contraseña (mínimo 12 caracteres) y repítela. La terminal no muestra lo que escribes.
Guárdala en un gestor de contraseñas: es la que introducirás para ingresar.

El comando imprime `ADMIN_PASSWORD_HASH=scrypt:...`. El valor después de `=` es una
representación protegida de la contraseña. Copia todo el valor, incluidos los dos puntos.
**No se introduce el hash en la pantalla de login; se introduce la contraseña original.**

Añade estas dos variables privadas, sustituyendo los marcadores:

```dotenv
ADMIN_USERNAME=EL_USUARIO_QUE_ELEGISTE
ADMIN_PASSWORD_HASH=EL_HASH_COMPLETO_GENERADO
```

### Dónde colocarlas

**Local:** añade las líneas a `.env.local`, sin subirlo a Git, y reinicia `npm run dev`.
Abre `http://localhost:3000/admin`.

**Netlify:** abre el proyecto correcto → **Project configuration → Environment variables**.
Crea `ADMIN_USERNAME` con solamente el usuario en Value. Crea `ADMIN_PASSWORD_HASH` con solamente
el hash en Value. Si hay Scopes, necesitan **Functions**; All scopes también funciona, pero
amplía qué tareas pueden leer esas variables. No llevan prefijo `NEXT_PUBLIC_`.

También puedes añadir las dos líneas a tu `.env.netlify` privado, conservando las variables
actuales, e importar el archivo completo mediante **Import from a .env file**.
`npm run check:netlify-env` exige las variables del panel en modo con pagos y valida su formato.
No pegues todo el archivo en el Value de una sola variable.

**Same value for all deploy contexts** usa el valor para todos los tipos de deploy dentro de
ese proyecto. Está bien para el proyecto aislado de pruebas. Producción debe tener su propia
base y credenciales, sin compartirlas con previews. Los cambios de variables necesitan un nuevo
deploy: configura y revisa todo antes de publicar una sola vez.

El panel exige iniciar sesión; las APIs privadas rechazan visitantes anónimos. Las sesiones
duran ocho horas, usan cookie HttpOnly/SameSite Strict y Secure en HTTPS, y almacenan solamente
el hash del token en la base. Cambiar usuario o hash invalida las sesiones anteriores. Hay un
límite persistente de diez intentos por conexión en quince minutos. Cerrar sesión revoca su token.
Ocultar enlaces y `noindex` no reemplaza estos controles.

## 3. Conservar las reservas gratuitas de prueba

Solo en desarrollo local o en el sitio Netlify separado de pruebas:

```dotenv
BOOKING_ENABLED=true
BOOKING_ACTIVE_DOMES=domo-amplio
BOOKING_CURRENCY=USD
PRICE_DOMO_AMPLIO_CENTS=12500
NEXT_PUBLIC_BOOKING_TEST_MODE=true
BOOKING_TEST_SECRET=TU_CLAVE_PRIVADA_DE_PRUEBA
TILOPAY_CHECKOUT_ENABLED=false
BOOKING_RECONCILE_ENABLED=false
```

El precio es un ejemplo. La clave debe tener al menos 24 caracteres alfanuméricos, guion o
guion bajo. Configura además la base y los dos iCal del amplio siguiendo
[pruebas-netlify-ical.md](pruebas-netlify-ical.md).

En `/reservar`, el huésped elige fechas y completa nombre, correo, teléfono y país de residencia.
No se solicitan dirección, ciudad, provincia ni código postal. La clave de prueba confirma
sin contactar a Tilopay. Esa reserva sí se exporta y puede bloquear anuncios reales:
acuerda las fechas con los dueños. Se cancela desde su estado o desde `/admin`.

En producción configura `NEXT_PUBLIC_BOOKING_TEST_MODE=false` y elimina `BOOKING_TEST_SECRET`.
El servidor rechazará el flujo gratuito aunque alguien envíe el encabezado de prueba.

## 4. Activar y probar pagos

La configuración privada `.env.netlify` de pruebas deja ambos precios en **USD 0,01 por noche**:

```dotenv
BOOKING_CURRENCY=USD
PRICE_DOMO_ROMANTICO_CENTS=1
PRICE_DOMO_AMPLIO_CENTS=1
```

Dos noches cuestan USD 0,02. El precio mínimo que acepta nuestro código es un centavo;
la documentación pública de `createLinkPayment` no especifica un mínimo aceptado por el
procesador de la cuenta. No se ha comprobado un cobro real de USD 0,01. Si Tilopay rechaza
el importe, confirma su mínimo con soporte antes de aumentarlo: no se redondea ni cobra más
automáticamente. Restaura las tarifas reales antes de publicar para huéspedes.

Cambiar precios no activa pagos ni habilita el romántico: `BOOKING_ACTIVE_DOMES` conserva
solo el amplio hasta configurar también los calendarios del romántico. Actualiza las dos
variables de precio en Netlify o vuelve a importar `.env.netlify` y aplica un nuevo deploy
para que el sitio publicado utilice los valores nuevos. Para probar el flujo de pago,
configura las credenciales y cambia los indicadores siguiendo los pasos de esta sección;
con el modo gratuito activado no se visitará la pasarela.

Se crean enlaces Tilopay de **un solo uso**, con referencia e importe calculados en el servidor,
retorno y webhook. Esta API no exige la dirección para crear el enlace; no se envían domicilios
inventados. Tilopay podría solicitar información adicional en su propia pantalla según el comercio
y el método de pago.

Para confirmar, el servidor consulta el detalle autenticado del enlace, verifica ID/referencia/
importe/moneda, obtiene las órdenes asociadas y consulta la transacción. Exige aprobación,
captura, importe, moneda y entorno correctos. El navegador y el webhook no son prueba de pago.

Configura con la cuenta de comercio de los dueños:

| Variable | Valor que debes obtener |
| --- | --- |
| `TILOPAY_API_USER` | Usuario API de Tilopay |
| `TILOPAY_API_PASSWORD` | Contraseña API, no la contraseña del administrador de Macas Moon |
| `TILOPAY_API_KEY` | Key de la integración del comercio |
| `TILOPAY_MERCHANT_ID` | Identificador del comercio, si corresponde |
| `TILOPAY_EXPECTED_ENVIRONMENT` | `Test` durante pruebas de pasarela; `Production` para cobros reales |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Clave pública del widget Cloudflare Turnstile para este dominio |
| `TURNSTILE_SECRET_KEY` | Clave privada del mismo widget |
| `SMTP_USER` | Gmail remitente: macasmoonglamping@gmail.com |
| `SMTP_PASSWORD` | Contraseña de aplicación de Google, nunca la normal |
| `BOOKING_REPLY_TO` | Opcional; si falta, se usa el mismo Gmail |
| `BOOKING_RECONCILE_SECRET` | Clave privada larga para la conciliación |

El formulario exige Turnstile antes del pago. El validador de deploy también exige preparar
Gmail, pero su fallo no invalida una reserva pagada: el correo queda pendiente y puede
reintentarse. El servidor envía por SMTP/TLS, sin Resend ni DNS adicionales. El correo es un
comprobante de reserva, no una factura electrónica tributaria. Se serializan envíos y se usa
Message-ID estable, pero SMTP no ofrece idempotencia: un fallo tras entregar y antes de
guardar podría duplicar un correo. No se promete entrega exactamente una vez.

**Antes de cobrar realmente:**

1. Verifica con Tilopay que la cuenta está en modo de pruebas. Pruebas y producción comparten
   host: cambiar la variable de la web NO cambia el modo del comercio.
2. Prueba en el sitio separado con `NEXT_PUBLIC_BOOKING_TEST_MODE=false`,
   `TILOPAY_CHECKOUT_ENABLED=true`, `TILOPAY_EXPECTED_ENVIRONMENT=Test` y credenciales de pruebas.
   No uses tarjetas reales para una prueba sin haber comprobado el modo del comercio.
3. Confirma con Tilopay el contrato de `getDetailLinkPayment`: la documentación pública no define
   todos los campos de los elementos de `payments`. El adaptador admite `orderNumber`; si recibe
   otro contrato falla de forma segura y no confirma. Debe comprobarse con la cuenta de comercio.
4. Prueba aprobación, rechazo, abandono, retorno sin pago, webhook, correo y confirmación sin
   regresar al sitio. Los tests automáticos simulan Tilopay; no sustituyen estas pruebas.
5. Mantén `BOOKING_RECONCILE_ENABLED=true`. Netlify invoca el respaldo cada **15 minutos** en
   el deploy publicado; el webhook y el retorno verifican al recibirse. Se intentan cerrar
   enlaces vencidos y se registran incidentes de pagos
   tardíos para gestión del administrador; esto no realiza reembolsos.
6. Comprueba Apple Pay/Google Pay en la cuenta y dispositivos compatibles: su disponibilidad
   depende del comercio y el dispositivo. No se prometen como habilitados por defecto.
7. Una vez aprobadas tarifas y condiciones por los dueños y superadas las pruebas, utiliza
   `TILOPAY_EXPECTED_ENVIRONMENT=Production` con la configuración real.

iCal no tiene costo de licencia. Hosting, base, correo y procesamiento de pagos sí pueden
generar cargos. No se han creado ni configurado cuentas de esos proveedores automáticamente.

Referencias: [crear enlace Tilopay](https://tilopay.com/developers/api/links-de-pago/create-link-payment),
[detalle del enlace](https://tilopay.com/developers/api/links-de-pago/detail-link-payment),
[consulta de pago](https://tilopay.com/developers/api/procesos-operativos/consult).

## 5. Bloqueos y reaperturas en Expedia

1. En `/admin`, selecciona domo, primera noche, día de salida y motivo. Para bloquear la noche
   del 6 de mayo, el rango es 6 → 7. El día de salida no se bloquea. Máximo 365 noches.
2. La web publica el bloqueo en su `.ics`, sin motivos ni datos personales. Los otros canales
   deben importar ese enlace y consultan según sus propios tiempos.
3. **Actualizar desde Airbnb y Expedia** relee sus feeds en nuestra web. No obliga a esas
   plataformas a consultar nuestro calendario.
4. **Quitar bloqueo** o **Cancelar prueba** libera las noches locales y retira el evento del `.ics`.
5. **Comprueba Expedia:** en nuestras pruebas ha conservado cierres después de quitarlos tanto
   en la web como en Airbnb. Si persisten, reabre manualmente solo esas noches de esa unidad,
   comprobando antes que no exista una reserva o bloqueo válido. No reabras otras fechas.
6. Actualiza en Airbnb su calendario importado de Expedia y comprueba la web. Esta puede seguir
   cerrando una noche mientras cualquiera de los feeds externos la siga exportando.
7. No desconectes/reconectes enlaces para intentar forzar actualizaciones. Si el bloqueo vuelve,
   investiga qué feeds lo exportan y solicita soporte Expedia con unidad/fecha/historial.

Es una limitación observada en nuestras pruebas, no una afirmación sobre todas las cuentas
Expedia. Se mantiene iCal con el riesgo residual aceptado. La restricción SQL impide duplicidad
entre reservas y bloqueos de esta web, no transacciones simultáneas en plataformas externas.

## 6. Comprobaciones antes de un único deploy

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Los tests no cargan `.env` ni contactan servicios reales: utilizan PostgreSQL en memoria y
respuestas simuladas de calendarios, pagos y correo. La conexión en memoria está serializada:
la prueba de intentos simultáneos valida el resultado y la restricción SQL, no reproduce todos
los bloqueos de un servidor PostgreSQL con varias conexiones.

Para probar visualmente, ejecuta `npm run dev` con base de pruebas y abre `/reservar`, `/admin`
y `/api/calendar/domo-amplio/calendar.ics`. Sin sesión, `/admin` debe llevar al login y
`/api/admin/calendar` debe responder 401. Con sesión, crea y quita un bloqueo de prueba.

Revisa los cambios en `feature/reservas`; no hagas merge en `main` antes de aprobarlos.
Estos comandos no hacen commit, push ni deploy.
