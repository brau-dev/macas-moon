# Liberar fechas desde /admin

## Qué significa «Solicitud vencida»

Al continuar al pago se crea una solicitud y se guardan sus noches durante
30 minutos. Si no se confirma el pago dentro de ese plazo, la solicitud vence.
Puede pasar por abandonar el formulario, un pago rechazado, un fallo de verificación
o un pago que se verifica tarde. Cada intento puede tener un ID distinto.

**Vencida no significa deuda ni demuestra que se haya cobrado o reembolsado.**
Las solicitudes vencidas no bloquean disponibilidad ni se exportan por iCal.
Si Tilopay muestra un pago aprobado, verifica ese pago: la web no vuelve a
confirmar automáticamente una solicitud que ya perdió sus noches.

El listado muestra inicialmente las reservas y bloqueos activos. Pulsa
**Mostrar historial** para ver también solicitudes vencidas y anulaciones.
Los registros no se borran y las incidencias siguen visibles aunque el historial
esté oculto. El importe histórico no cambia cuando actualizas la tarifa por noche.

## Liberar las fechas de una reserva de esta web

1. Inicia sesión en `/admin`, selecciona el domo y el mes. Opcionalmente pulsa
   un día para limitar el listado a esa fecha.
2. Localiza el registro; si está vencido, pulsa **Mostrar historial**.
3. Pulsa **Liberar fechas** y comprueba el domo, fechas, huésped e ID del diálogo.
4. Escribe un motivo de entre 3 y 300 caracteres. Confirma las consecuencias.
   Si la reserva utiliza Tilopay, acepta expresamente que esta acción no realiza
   ni acredita un reembolso.
5. Pulsa **Confirmar liberación**. El registro queda anulado con la fecha,
   administrador, motivo y estado anterior. Solo se liberan sus propias noches.

La reserva se anula completa. No se cambia su importe, se eliminan datos de pago
ni se reembolsa dinero. Un reembolso se gestiona y comprueba separadamente en Tilopay.
No se envía un correo de cancelación en esta función; comunica el cambio al huésped.
Los correos de confirmación anteriores y las incidencias se conservan como historial.

Se comprueba el enlace de pago sin deshacer la anulación. Si la reserva ya estaba
pagada, se consulta a Tilopay y se verifica que el enlace sea de un solo uso, corresponda
a la reserva y tenga el pago aprobado/capturado correcto. En ese caso se registra
**uso consumido**, no un cierre ficticio, y no se intenta borrarlo repetidamente.
Para los demás enlaces se solicita el cierre. Si Tilopay falla, la anulación local
se conserva y el detalle seguro del fallo queda visible en la ficha; el respaldo reintenta.
Si un pago aún no verificado llega después de anular, queda como incidencia:
no se reactiva la reserva ni se recuperan noches que ya pudo reservar otra persona.
Anular una reserva que ya estaba confirmada no se confunde con un nuevo pago tardío.

## Liberar todo o parte de un bloqueo manual

1. Localiza el **Bloqueo manual** y pulsa **Liberar fechas**, igual que en una reserva.
2. El rango inicial es todo el bloqueo. Puedes reducirlo a las noches que quieres
   liberar. El último día es la salida y no se incluye.
3. Escribe el motivo, confirma las consecuencias y pulsa **Confirmar liberación**.

Ejemplo: un bloqueo del 1 al 6 de junio incluye las noches 1, 2, 3, 4 y 5.
Para liberar solo la noche del 3, selecciona del 3 al 4. Se conservan dos tramos:
del 1 al 3 y del 4 al 6. El bloqueo original queda en el historial y los nuevos
tramos mantienen el motivo original y una referencia a ese registro.

La liberación y las noches restantes se guardan en una sola transacción. Repetir
la misma solicitud no crea más tramos ni libera noches de otra reserva.

## Consultar una fecha ocupada

En el calendario de `/admin`, pulsa una fecha ocupada. Se abre un cuadro junto al
día con las reservas o bloqueos activos de ese domo: nombre, correo, teléfono,
huéspedes, país, fechas de estancia, importe y estado. En bloqueos manuales se
muestran sus fechas y motivo, no un huésped ficticio. Desde el cuadro puedes pulsar
**Liberar fechas**; siempre se abre la confirmación antes de modificar nada.

Puedes cerrarlo con la X, Escape o pulsando fuera. Cambiar de mes o de domo también
lo cierra. El día de salida no se considera ocupado por la reserva anterior.
Las solicitudes vencidas y anuladas permanecen en el historial, no se presentan
como huéspedes actuales. Los detalles se obtienen de la consulta ya cargada del
administrador: pulsar días no añade consultas a la base.

Si el cierre solo se importa por iCal, el cuadro indica Airbnb o Expedia, sin
inventar datos de huéspedes ni ofrecer liberarlo desde esta web. Estos detalles
son exclusivos del panel autenticado; no se añadieron al calendario público ni
al iCal. El cuadro de detalles no necesita una migración propia; la gestión del
estado de enlaces descrita a continuación requiere la 0005.

## Revisar un enlace desde el panel, sin buscar logs

1. Entra en `/admin`, elige el domo y el mes de la reserva.
2. Pulsa **Mostrar historial** para localizar la reserva anulada o solicitud vencida.
3. Si el enlace sigue sin resolverse, pulsa **Revisar enlace de pago**.
4. La ficha mostrará uno de estos resultados:
   - **Enlace de un solo uso: pago verificado y uso consumido.** Tilopay confirmó
     el uso de ese enlace y la transacción exacta. La reserva sigue anulada.
   - **Enlace de pago cerrado en Tilopay.** El proveedor confirmó el cierre.
   - **Estado sin confirmar.** No se afirma que esté abierto, cerrado ni que admita
     otro pago. Expande **Información para soporte** y comparte esa referencia,
     etapa y códigos, sin contraseñas ni datos de tarjeta.

Estos pasos no crean pagos, no reembolsan, no cambian importes y no reactivan noches.
No necesitas repetir una reserva ni volver a pagar para probar esta revisión.
El botón requiere sesión administrativa y solo actúa sobre solicitudes vencidas
o reservas anuladas del domo indicado. No cierra enlaces de reservas activas.

Los intentos del botón y del respaldo se coordinan en PostgreSQL: como máximo un
intento por registro cada dos minutos, incluso entre distintas funciones. El respaldo
mantiene su programación de 15 minutos si `BOOKING_RECONCILE_ENABLED=true`.
Los enlaces cerrados o consumidos dejan de entrar en la cola de cierre; consultar
el calendario no ejecuta esta operación. Un error no se transforma en éxito para
quitar una advertencia. No se guardan respuestas crudas de Tilopay ni enlaces privados
en el diagnóstico. El respaldo muestra además un resumen de operaciones fallidas
en los registros de `reconcile-reservations`, sin datos personales.

## Airbnb y Expedia

Solo puedes anular reservas y bloqueos creados en esta web. Las noches importadas
por iCal pertenecen a otro calendario y no se borran aquí.

El iCal de esta web deja de incluir la reserva anulada, o conserva solo los tramos
manuales restantes. Airbnb y Expedia deben volver a leerlo. Expedia puede conservar
un cierre y requerir reapertura manual, después de comprobar que no haya otra reserva.
La web también puede seguir mostrando noches ocupadas si un calendario externo
todavía las exporta. No desconectes/reconectes calendarios para intentar forzar cambios.

## Migración necesaria antes de publicar

La anulación requiere **0004_admin_cancellations.sql** y la gestión de enlaces
requiere **0005_payment_link_resolution.sql** en la misma base que usa el deploy.
El paso posterior a producción requiere además **0006_payment_environment.sql**:
registra como Test el historial de este sitio (que solo ha operado en pruebas) y
guarda explícitamente el entorno de cada reserva nueva. No se debe reutilizar esa
base histórica Test para un negocio ajeno con cobros anteriores desconocidos.
Son cambios aditivos: no borran reservas ni modifican importes. La 0005 añade fechas
de comprobación/consumo y un diagnóstico seguro; no marca enlaces antiguos como
resueltos sin consultarlos.

- Con Netlify Database y su sistema nativo, la migración está preparada en
  `netlify/database/migrations/0004_admin_cancellations.sql` y
  `netlify/database/migrations/0005_payment_link_resolution.sql`, seguidas de
  `netlify/database/migrations/0006_payment_environment.sql`. Comprueba en el
  registro de publicación que se apliquen antes de publicar esta versión.
  Si falla, no publiques manualmente código contra una base sin actualizar.
- Si gestionas las migraciones manualmente o usas una base externa, ejecuta
  las migraciones pendientes en orden: `db/004_admin_cancellations.sql` y después
  `db/005_payment_link_resolution.sql` y `db/006_payment_environment.sql`, tras las
  migraciones anteriores y antes de publicar. Aplica solo las pendientes. Usa el editor SQL de la base
  correspondiente; no pegues el archivo en variables de entorno.

[Funcionamiento de las migraciones nativas de Netlify](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/).
No hacen falta credenciales ni variables nuevas. Tilopay continúa en Test y se
mantiene la dirección del sitio de pruebas. No se han aplicado estas migraciones
a una base remota ni se han modificado reservas reales durante esta implementación.
Una vez desplegado, el administrador y el respaldo habilitado gestionan los enlaces
pendientes; consultar el calendario por sí solo no los modifica.
