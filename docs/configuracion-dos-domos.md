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

## 2. Actualizar Netlify una sola vez

1. Ejecuta `npm run check:netlify-env`. Antes de completar los dos enlaces del
   romántico mostrará esos dos faltantes: no inventes direcciones para pasar la validación.
2. Ejecuta `npm test`, `npm run typecheck`, `npm run lint` y `npm run build`.
3. En el proyecto **macasmoon-reservas-testing**, abre la configuración de variables
   de entorno y actualiza los valores usando **Import from a .env file** con el contenido
   de .env.netlify. El archivo no se sube al repositorio.
4. Conserva las credenciales privadas como secretos. `SMTP_USER` es el correo público
   de contacto: no lo marques como secreto, para no bloquear el escaneo de Netlify.
   No importes .env.local: su conexión de base es privada y Netlify ya aporta la suya.
5. Revisa los cambios, haz commit y push en `feature/reservas` cuando lo autorices.
   Si el push inicia el deploy automáticamente, no dispares otro manualmente.

No se necesitan migraciones nuevas por estos cambios de interfaz, precio y selección.
No se ha cambiado el comercio a Producción ni se han realizado cobros por ti.

## 3. Enlaces de nuestra web para importar en Airbnb y Expedia

| Anuncio de destino | Enlace que debe importar |
| --- | --- |
| Domo amplio, tanto en Airbnb como en Expedia | `https://macasmoon-reservas-testing.netlify.app/api/calendar/domo-amplio/calendar.ics` |
| Domo romántico, tanto en Airbnb como en Expedia | `https://macasmoon-reservas-testing.netlify.app/api/calendar/domo-romantico/calendar.ics` |

Cada enlace exporta únicamente las reservas confirmadas y bloqueos manuales de su
domo, sin nombres, correos ni información de pago. No intercambies enlaces entre domos.
La información importada de Airbnb/Expedia no se vuelve a exportar desde nuestra web.

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

## 5. Antes de abrir ventas reales

El sitio actual sigue sin cobrar dinero real. Cuando decidas abrir ventas, configura
el modo de Producción en Tilopay y cambia `TILOPAY_EXPECTED_ENVIRONMENT=Production`.
Actualiza el dominio autorizado de Turnstile si cambias de dirección y verifica la
configuración con `npm run check:netlify-env -- --production` antes de publicar.
No mezcles registros de operaciones simuladas con la base de ventas reales sin
revisar y resolver previamente sus bloqueos e incidencias. El cambio de modo no
convierte pagos simulados en cobros reales.
