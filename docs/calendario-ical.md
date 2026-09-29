# Calendario iCal: primera versión

La página `/reservar` consulta por separado los calendarios exportados de Airbnb y Expedia para cada domo. Los periodos `VEVENT` de ambos feeds se unen y se muestran como noches ocupadas; `DTEND` se interpreta como fecha de salida (exclusiva), de modo que se puede llegar el mismo día en que otro huésped sale. El visitante elige llegada y salida en el calendario y envía una **solicitud por WhatsApp**. La solicitud **no confirma ni crea una reserva**.

## Configuración

1. En Airbnb y Expedia, obtén la URL privada de **exportación iCal** de cada anuncio/domo. No uses el enlace de importación, ni el calendario de un domo para el otro. Verifica que las correspondencias Domo 1 = `domo-amplio` y Domo 2 = `domo-romantico` coincidan con los anuncios reales.
2. Copia las variables de `.env.example` a `.env.local` y asigna los cuatro enlaces `ICAL_..._URL` (dos por domo). Reinicia `npm run dev` tras cambiarlas. No compartas públicamente ni hagas commit de los enlaces: funcionan como credenciales de lectura.
3. Para un deploy de prueba en Netlify, añade esas cuatro variables en **Environment variables** del sitio con acceso para Functions y Builds, y vuelve a desplegar la rama de pruebas. Mantén la rama principal y el sitio activo sin cambios hasta verificar.
4. Abre `/reservar?domo=domo-amplio` y `/reservar?domo=domo-romantico`. El endpoint `/api/availability/domo-amplio` (o `domo-romantico`) debe devolver `status: "ready"` y los intervalos `blocked`. Nunca devuelve las URLs privadas. Si falta o falla una fuente, el calendario queda deshabilitado para no presentar noches como libres sin comprobar ambas fuentes.

La página almacena el último resultado hasta cinco minutos **por instancia del servidor** y vuelve a consultar después. Si una fuente deja de responder, se muestra una advertencia; el formulario de WhatsApp sigue disponible para consultar manualmente.

## Prueba segura

Usa fechas futuras sin huéspedes. Bloquea una noche de prueba en uno de los anuncios, espera a que aparezca en su exportación iCal y comprueba el endpoint y el calendario de la web. Repite desde el otro anuncio y para cada domo. Quita el bloqueo y vuelve a comprobar después del siguiente refresco. No crees reservas reales ni canceles reservas de huéspedes solo para probar.

## Límites importantes

- iCal funciona por **sondeo**. Airbnb, Expedia y la página actualizan en momentos distintos; ninguna de estas actualizaciones es instantánea ni atómica. Esta solución no elimina al 100 % las reservas dobles si las tres plataformas aceptan reservas simultáneamente.
- La página **solo importa** los calendarios de Airbnb y Expedia. Como todavía no guarda reservas confirmadas en una base de datos, no puede exportar sus propias ocupaciones ni bloquear automáticamente los otros canales cuando llega un WhatsApp. Tampoco procesa pagos.
- Para aceptar y cobrar reservas directas de forma automática y segura se necesita un almacén transaccional de reservas, confirmación de pago y una integración de disponibilidad que pueda bloquear los canales con garantías suficientes. Publicar un botón de pago ahora prometería una confirmación que iCal por sí solo no puede asegurar.
- Si Airbnb y Expedia ya se importan mutuamente por iCal, puedes mantener esa conexión; esta web lee ambas exportaciones independientemente. No importes la misma URL circularmente entre plataformas ni cambies conexiones existentes sin verificar sus efectos.
