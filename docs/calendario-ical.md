# Calendarios iCal de Airbnb, Expedia y Macas Moon

La página `/reservar` importa los calendarios de Airbnb y Expedia de cada domo y combina sus noches con las reservas y bloqueos locales de PostgreSQL. Los periodos `VEVENT` se muestran como ocupados; `DTEND` es la salida exclusiva. Una estancia del 4 al 5 bloquea la noche del 4, no la del 5.

El visitante elige fechas, introduce nombre, correo, teléfono y país de residencia, y continúa a Tilopay. Solo el pago verificado confirma la reserva. En el sitio separado de pruebas puede confirmarse sin cobro mediante la clave privada. No hay solicitud de reserva por WhatsApp.

El administrador accede a `/admin` con usuario y contraseña para consultar reservas y crear/quitar bloqueos. Sigue [panel y pagos](panel-admin-y-pagos.md) y [pruebas Netlify](pruebas-netlify-ical.md) para configurar la base, las credenciales y los servicios.

## Configuración

1. En Airbnb y Expedia, obtén la URL privada de **exportación iCal** de cada anuncio/domo. No uses el enlace de importación, ni el calendario de un domo para el otro. Verifica que las correspondencias Domo 1 = `domo-amplio` y Domo 2 = `domo-romantico` coincidan con los anuncios reales.
2. Copia las variables de `.env.example` a `.env.local` y asigna los cuatro enlaces `ICAL_..._URL` (dos por domo). Reinicia `npm run dev` tras cambiarlas. No compartas públicamente ni hagas commit de los enlaces: funcionan como credenciales de lectura.
3. Para el sitio separado de pruebas, usa `BOOKING_ACTIVE_DOMES=domo-amplio` y solo los dos enlaces de ese domo. No modifiques el romántico hasta terminar la prueba. Netlify debe tener las variables de iCal, la base y las migraciones aplicadas. Mantén `main` y el sitio activo sin cambios hasta verificar.
4. Abre `/reservar?domo=domo-amplio` y `/reservar?domo=domo-romantico`. El endpoint `/api/availability/domo-amplio` (o `domo-romantico`) debe devolver `status: "ready"` y los intervalos `blocked`. Nunca devuelve las URLs privadas. Si falta o falla una fuente, el calendario queda deshabilitado para no presentar noches como libres sin comprobar ambas fuentes.

La página almacena el resultado hasta cinco minutos **por instancia del servidor**, no como un cron global. La consulta pública utiliza esa caché; el formulario actualiza al abrir, volver a la pestaña o pulsar "Actualizar disponibilidad", sin consultas permanentes cada minuto. Antes de crear una reserva o bloqueo manual, el servidor fuerza una lectura nueva. El administrador también puede forzar esa lectura. Si una fuente falla, las nuevas reservas y bloqueos se rechazan hasta poder comprobar la disponibilidad. Para el deploy actual con pago obligatorio sigue [deploy-reservas-con-pago.md](deploy-reservas-con-pago.md).

## Exportación hacia las plataformas

Cada plataforma importa la URL del domo correspondiente:

- `/api/calendar/domo-amplio/calendar.ics`
- `/api/calendar/domo-romantico/calendar.ics`

Utiliza el dominio público del sitio, no `localhost`. La plataforma hace una solicitud HTTP a esa URL según su propio horario. La web responde con las reservas locales confirmadas y los bloqueos manuales activos. No exporta bloqueos temporales de pago ni vuelve a exportar noches importadas de Airbnb/Expedia. Los eventos no contienen datos del huésped ni el motivo del administrador. Estos feeds públicos no necesitan tokens de salida.

## Prueba segura

Usa fechas futuras sin huéspedes y acordadas con los dueños. Prueba reservas gratuitas y bloqueos manuales desde la web, verificando el `.ics` y la importación externa. Prueba después retirar esos eventos y verificar la reapertura, no solo el cierre. No canceles reservas reales ni alteres el romántico durante la prueba del amplio.

## Reapertura manual en Expedia

Se ha observado en estas pruebas que Expedia conserva noches cerradas tras cancelar una reserva de la web o retirar un bloqueo de Airbnb. No se afirma que todas las cuentas Expedia tengan ese comportamiento. Si persiste el cierre, comprueba primero que no exista otra reserva/bloqueo válido y reabre manualmente solo las noches de esa unidad en Partner Central. Luego actualiza el calendario de Expedia importado en Airbnb y comprueba nuestra web.

No desconectes/reconectes calendarios para intentar forzar la actualización. La web puede seguir mostrando una noche ocupada mientras un feed externo siga exportándola. Los colores del panel indican qué feed anuncia la noche, no necesariamente dónde se originó.

## Límites importantes

- iCal funciona por **sondeo**. Airbnb, Expedia y la página actualizan en momentos distintos; ninguna de estas actualizaciones es instantánea ni atómica. Esta solución no elimina al 100 % las reservas dobles si las tres plataformas aceptan reservas simultáneamente.
- La base impide que dos reservas/bloqueos locales ocupen la misma noche. No evita una reserva simultánea aceptada por Airbnb o Expedia antes de importar nuestro `.ics`.
- Un pago pendiente bloquea localmente las noches durante 30 minutos, pero no se exporta como reserva confirmada. Un pago aprobado después de vencer ese plazo requiere gestión del administrador.
- Si Airbnb y Expedia se importan mutuamente, los feeds pueden anunciar cierres que se originaron en otra plataforma. No confundas una noche importada con una reserva real; verifica el origen antes de reabrirla.
- La licencia iCal es gratuita; los servicios de hosting, base, correo y procesamiento de pagos pueden tener costos. Se conserva esta arquitectura con el riesgo residual aceptado y la gestión manual de reaperturas que Expedia no procese.
