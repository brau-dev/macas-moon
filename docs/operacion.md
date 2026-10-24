# Manual del administrador

Entrar en `/admin` con el usuario y la contraseña original, no con el hash.
La sesión dura ocho horas; cerrar sesión al terminar. La configuración y renovación
de credenciales están en [configuración y publicación](configuracion-y-deploy.md).

## Calendario y disponibilidad

Seleccionar **Domo Amplio** o **Domo Romántico** y el mes. Cada domo conserva sus
reservas, precios, incidencias y fuentes importadas. Pulsar una noche ocupada abre
los detalles de sus reservas/bloqueos activos. Si el cierre viene de Airbnb o
Expedia, se indica la fuente; los datos de sus huéspedes no se inventan ni se
puede liberar esa reserva desde aquí.

**Mostrar historial** incluye solicitudes vencidas y anuladas. El importe histórico
no cambia al editar precios. Consultar el calendario no anula reservas ni cierra
enlaces. **Actualizar desde Airbnb y Expedia** relee sus calendarios en nuestra web;
no obliga a esas plataformas a actualizarse.

| Estado local | Significado |
| --- | --- |
| Pago pendiente | Solicitud aún sin confirmar; aparta noches mientras el bloqueo esté vigente. |
| Confirmada | Reserva confirmada o bloqueo manual activo; ocupa noches y se exporta por iCal. |
| Solicitud vencida | Perdió el bloqueo; no ocupa noches ni se exporta. No demuestra cobro, deuda o reembolso. |
| Anulada | Se canceló el registro local y se liberaron sus noches; conserva historial. |

## Cambiar precios

1. Elegir domo y **Editar precios**. El calendario administrador muestra moneda e
   importe por noche; «Sin tarifa» significa que no pudo verificarse el precio.
2. Seleccionar primera y última noche, ambas incluidas, o escribir las fechas.
   Por ejemplo, 24 al 26 cambia las noches 24, 25 y 26; no es un rango de estancia.
3. Escribir el precio por noche (`200` o `200,50`) y pulsar
   **Aplicar precio a las noches seleccionadas**. Máximo 365 noches por operación.
4. **Restablecer precio base en este rango** retira las tarifas especiales elegidas;
   el precio base actual es USD 170.

El huésped consulta total y desglose al seleccionar llegada/salida. El servidor
vuelve a comprobarlos antes de crear el pago; si cambiaron, pide revisar el total.
Las reservas y enlaces ya creados conservan su importe. Editar precios no cambia
reservas, otros domos ni tarifas de Airbnb/Expedia: iCal solo comunica disponibilidad.

## Bloquear o liberar noches

Para un bloqueo manual, seleccionar domo, llegada, salida y motivo en
**Bloquear noches manualmente**. La salida queda libre: para ocupar la noche del
6, usar 6 → 7. Máximo 365 noches; se comprueban ambas fuentes externas antes de guardar.

Para anular una reserva o retirar un bloqueo, pulsar **Liberar fechas**, comprobar
domo/registro, escribir motivo (3–300 caracteres), aceptar las consecuencias y
**Confirmar liberación**. Con Tilopay se exige aceptar que no se realiza ni acredita
un reembolso. Se conserva quién lo hizo, cuándo, por qué y el estado anterior.

Una reserva se anula completa. Un bloqueo manual permite liberación parcial:
en un bloqueo del 1 al 6, liberar 3 → 4 deja los tramos 1 → 3 y 4 → 6.
El original permanece en el historial; la operación guarda todos los cambios juntos.
No se borra la información financiera ni se envía correo automático de cancelación:
comunicar el cambio al huésped y gestionar cualquier reembolso aparte en Tilopay.
Un fallo al cerrar el enlace no deshace la anulación ni recupera noches.

## Pagos, enlaces e incidencias

Mantener separados **reserva local**, **enlace Tilopay**, **transacción real** y
**resolución administrativa**. Anular una reserva o eliminar su enlace no anula
ni reembolsa una transacción. Un HTTP 400 no prueba que el enlace esté cerrado.

| Acción o aviso | Qué hacer y qué significa |
| --- | --- |
| **Verificar pago** | Consulta Tilopay; puede confirmar y enviar correos si el pago es válido y las noches siguen apartadas. Si el bloqueo ya se perdió, registra incidencia sin recuperar noches. |
| **Reintentar correos pendientes** | Reintenta por separado huésped y negocio; un correo fallido no invalida una reserva confirmada. Revisar spam y configuración, sin cobrar de nuevo. |
| **Revisar enlace de pago** | En el historial de vencidas/anuladas, comprueba el enlace y puede solicitar su cierre. No realiza reembolsos ni reactiva la reserva. Los intentos se separan al menos dos minutos. |
| Enlace cerrado | Tilopay confirmó su eliminación; no acredita ausencia de cobro ni reembolso. |
| Uso consumido | Enlace `Just Once` con transacción exacta verificada. Puede seguir vencida/anulada y requerir atención por pago tardío; no se intenta borrarlo repetidamente. |
| Estado del enlace sin confirmar | Conservar el aviso y abrir **Información para soporte**. Compartir referencia, etapa y códigos, nunca credenciales ni datos de tarjeta. |
| **Pago sin verificar** | Falló la consulta, incluso si el enlace consta cerrado. No prueba un cobro ni una compra abandonada; revisar la transacción antes de darlo por atendido. |

Antes de eliminar un enlace se inspecciona su detalle y se conservan identidades
autenticadas de intentos conocidos. Si esa lectura falla, no se solicita la
eliminación en ese intento; las noches vencen igualmente a su hora. El cierre se
solicita desde el minuto 10, sin liberar el bloqueo antes de los 15 minutos y sin
garantizar cuándo responderá Tilopay. El [pendiente de lanzamiento](README.md)
describe el caso del pago en proceso que todavía no aparece en ese detalle.

El respaldo reintenta verificaciones de solicitudes vencidas recientes durante
siete días; los enlaces antiguos sin resolver pueden seguir requiriendo revisión.
Los avisos de pago se muestran para el domo aunque no pertenezcan al mes elegido.
«Pago sin verificar» se retira tras una consulta autenticada satisfactoria; no
borra una incidencia de pago aprobado ni se resuelve con el botón siguiente.

Para **Resolver incidencia**, revisar y atender primero el cobro en Tilopay.
En **Pagos que requieren atención**, abrir **Resolver incidencia**, escribir el
resultado de la revisión, marcar la confirmación y pulsar **Sí, resolver incidencia**.
**Volver sin cambios** no guarda nada. Se conservan motivo original, nota,
administrador y fecha. Esta acción no reembolsa, confirma o cancela reservas,
libera noches ni cierra enlaces. Una incidencia distinta vuelve a mostrarse sin
perder las revisiones previas; no ocultar errores reales para limpiar el panel.

## Airbnb y Expedia

La web recibe cuatro enlaces **privados**, uno por domo/plataforma, y publica estos
dos iCal de salida para importar en los anuncios correspondientes:

| Domo | Enlace público para importar en Airbnb y Expedia |
| --- | --- |
| Amplio | `https://macasmoon-reservas-testing.netlify.app/api/calendar/domo-amplio/calendar.ics` |
| Romántico | `https://macasmoon-reservas-testing.netlify.app/api/calendar/domo-romantico/calendar.ics` |

También se pueden copiar desde **Sincronización** en el panel. No intercambiar
domos ni confundir la exportación de cada plataforma con estos enlaces de nuestra
web. No necesitan login ni token, no incluyen huéspedes o motivos administrativos
y no vuelven a exportar los cierres importados. Siguen disponibles aunque se
desactiven nuevas reservas del domo. Las rutas antiguas con token no se utilizan.

Las plataformas consultan a su propio ritmo. Tras liberar noches, comprobar tanto
el cierre como la reapertura externa: Expedia puede conservar un cierre y requerir
reapertura manual, solo de esa unidad/fecha y tras descartar otra reserva válida.
Si cualquier feed externo sigue exportando la noche, la web puede mostrarla ocupada.
No desconectar/reconectar calendarios para forzar actualizaciones; verificar el
origen, ya que un feed puede repetir cierres recibidos de otro canal.

Si Tilopay muestra aprobación y la web no confirma, conservar el ID y la referencia
de soporte, verificar el pago desde el panel y atender cualquier incidencia;
**no repetir el pago ni cambiar estados directamente en SQL**. Para un fallo de
precios/iCal, usar `npm run check:published` con apoyo técnico. Un iCal vacío válido
puede ser correcto; un error de base no debe confundirse con fechas libres.
