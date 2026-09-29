# Reservas con Cloudbeds y Tilopay

La web utiliza Cloudbeds como fuente única de disponibilidad y reservaciones. Tilopay procesa los pagos desde el Booking Engine alojado de Cloudbeds. El formulario de WhatsApp se conserva como alternativa de atención, pero no bloquea inventario por sí solo.

## Flujo de producción

1. Airbnb, Booking.com y los demás canales se conectan por API al Channel Manager de Cloudbeds.
2. La página `/reservar` muestra el calendario oficial de Cloudbeds.
3. Cloudbeds redirige al huésped a su Booking Engine alojado con las fechas elegidas.
4. El Booking Engine crea la reservación y redirige a Tilopay para realizar el pago.
5. Tilopay registra el resultado del pago en la reservación de Cloudbeds.
6. Cloudbeds distribuye el nuevo inventario a todos los canales conectados.

No se deben conectar los canales entre sí por iCal cuando ya estén conectados al Channel Manager. Cloudbeds debe ser la única fuente de inventario.

## Configuración de Cloudbeds

1. Crear una propiedad con dos alojamientos independientes:
   - `Macas Moon Domo 1 · Amplio`
   - `Macas Moon Domo 2 · Romántico`
2. Configurar tarifas, impuestos, capacidad, estancia mínima, antelación, políticas y moneda.
3. Conectar Airbnb y Booking.com desde el Channel Manager y mapear cada anuncio con el alojamiento correspondiente.
4. Activar Booking Engine Plus.
5. En `Booking Engine > Embeds`, habilitar el calendario Premium.
6. Agregar a `Whitelisted domains`:
   - `macasmoon.com`
   - `www.macasmoon.com`
   - el dominio de preview de Netlify utilizado para pruebas, si se necesita
7. En `Booking Engine > Summary`, copiar el código público de seis caracteres que aparece al final de `https://hotels.cloudbeds.com/reservation/CODIGO`.
8. Obtener el Room Type ID de cada domo en `Settings > Property > Accommodations`.

## Configuración de Tilopay

1. Crear y aprobar la cuenta comercial de Tilopay.
2. En Cloudbeds, abrir `Apps & Marketplace`, buscar Tilopay y conectar la aplicación.
3. Activar Booking Engine Plus.
4. Seguir el asistente oficial de Tilopay para crear la opción de pago y la redirección posterior a la reservación.
5. Probar primero en modo sandbox.

Las llaves, usuarios y contraseñas de Tilopay no se agregan a variables `NEXT_PUBLIC_*`, al repositorio ni al frontend. La conexión oficial entre Cloudbeds y Tilopay administra esas credenciales.

## Variables en Netlify

Agregar en `Project configuration > Environment variables`:

```text
NEXT_PUBLIC_ONLINE_BOOKING_ENABLED=true
NEXT_PUBLIC_CLOUDBEDS_CALENDAR_ENABLED=true
NEXT_PUBLIC_CLOUDBEDS_PROPERTY_CODE=ABC123
NEXT_PUBLIC_CLOUDBEDS_DOMO_ROMANTICO_RID=123456
NEXT_PUBLIC_CLOUDBEDS_DOMO_AMPLIO_RID=123457
```

Los valores anteriores son ejemplos. Después de guardarlos hay que ejecutar un nuevo deploy porque las variables `NEXT_PUBLIC_*` se incorporan durante el build.

La moneda mostrada en el calendario y en el checkout se toma directamente de la configuración de la propiedad en Cloudbeds; no se fija desde esta web.

Si el plan de Cloudbeds todavía no incluye el calendario Premium, puede habilitarse la reserva online con:

```text
NEXT_PUBLIC_ONLINE_BOOKING_ENABLED=true
NEXT_PUBLIC_CLOUDBEDS_CALENDAR_ENABLED=false
```

En ese caso la página ofrece el enlace al Booking Engine alojado, pero no muestra disponibilidad dentro de `macasmoon.com`.

## Regla operativa para WhatsApp

Una conversación de WhatsApp nunca confirma ni bloquea fechas automáticamente. Cuando se acuerde una reserva o un bloqueo por WhatsApp, el personal debe registrarlo inmediatamente en Cloudbeds. Solo entonces se sincronizará con Airbnb, Booking.com y la página.

## Pruebas antes de publicar

- Bloquear una fecha en Cloudbeds y verificar que no se pueda reservar en la web ni en las OTA.
- Crear una reserva de prueba desde la web y verificar su aparición en Cloudbeds.
- Confirmar que la reserva cierre inventario en Airbnb y Booking.com.
- Probar pago aprobado, rechazado y abandonado en Tilopay.
- Definir y comprobar cuánto tiempo puede quedar una reserva pendiente de pago antes de liberar inventario.
- Cancelar la reserva de prueba y confirmar que las fechas vuelvan a estar disponibles.
- Probar ambos domos, capacidades, estancia mínima, impuestos, monedas y correos de confirmación.
- Repetir el flujo en español, inglés, francés y alemán, en computadora y teléfono.
