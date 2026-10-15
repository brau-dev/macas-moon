# Consumo de base de datos: prioridad a la fiabilidad

Se mantiene Tilopay en Test, la dirección actual y el respaldo de pagos/correos
cada 15 minutos. No se necesita otra cuenta, variable ni migración por estas
optimizaciones. No se introdujo un almacén ni una cola externa.
La función posterior de anulación administrativa sí necesita su migración 0004;
consulta [Anular reservas y bloqueos](anular-reservas-y-bloqueos.md).

## Cambios aplicados

- Consultar el calendario administrador ejecuta dos SELECT, sin la transacción
  de limpieza que antes añadía BEGIN, UPDATE y COMMIT en cada consulta. La
  autenticación conserva su consulta independiente: no se almacena en caché.
- Un bloqueo pendiente vencido aparece como vencido sin modificar la base solo
  por verlo. Al crear otra reserva o bloqueo, sus noches se liberan dentro de
  la transacción que adquiere las nuevas noches. Se mantiene la restricción
  única por domo y noche que impide duplicarlas dentro de esta web.
- El respaldo prioriza pagos pendientes sobre enlaces vencidos. No vuelve a
  consultar continuamente en Tilopay un pago tardío que ya quedó registrado
  como incidencia y cuyo enlace ya está cerrado. La incidencia NO se oculta ni
  se elimina del panel: requiere gestión de los dueños.
- El cierre de enlaces vencidos se reintenta de forma independiente, incluso
  si la verificación detectó un pago tardío. También se pueden cerrar enlaces
  antiguos cuyo cierre había fallado. No implica reembolso ni confirmación.
- Las conexiones tienen un límite de tres por instancia y 10 segundos de
  espera para conseguir conexión; las conexiones ociosas se cierran a los
  10 segundos. Se manejan errores de conexión ociosa sin terminar el proceso
  ni imprimir la dirección privada o contraseña de la base.

## Lo que no se cambia para ahorrar

El respaldo sigue ejecutándose cada 15 minutos y consultando PostgreSQL aun
cuando no encuentre trabajo. No se deshabilitaron los reintentos de correos,
webhooks ni retorno de Tilopay. Los pagos desconocidos/vencidos recientes
conservan su ventana de verificación de siete días.

Los enlaces iCal y la disponibilidad siguen leyendo la base. Al reservar se
vuelven a consultar Airbnb y Expedia; no se usa una instantánea antigua para
aceptar pagos. No se añadió tiempo de caché al iCal público.

**Estas mejoras evitan trabajo redundante, pero no eliminan el consumo fijo
del respaldo ni garantizan que el plan de 1000 créditos alcance.** Reducirlo
mucho más requeriría un diseño persistente de tareas, con su propia gestión
de fallos y concurrencia, o evaluar otra configuración/proveedor de base.
No se añade esa complejidad al proceso de cobro solo para ahorrar créditos.

## Publicación y comprobación

1. Ejecuta `npm run check:deploy` antes de publicar. No usa la base real para las
   pruebas ni cobra/envía correos. Revisa además las variables según
   [Configuración de los dos domos](configuracion-dos-domos.md).
2. Agrupa estos cambios con los anteriores en un solo deploy de `feature/reservas`.
   No cambies `BOOKING_RECONCILE_ENABLED=true` ni el modo Test de Tilopay.
3. Tras publicar, ejecuta `npm run check:published` una vez y verifica el flujo
   completo con una tarjeta de simulación autorizada. Una reserva simulada
   confirmada sí puede bloquear anuncios reales conectados por iCal.
4. Compara el aumento de Database compute durante las siguientes 24–48 horas
   con el mismo período anterior. Distingue uso de pruebas, otros proyectos y
   otros conceptos de facturación. No mantengas herramientas que consulten
   la base continuamente solo para medirla: también generan consumo.

La auditoría de dependencias de producción (`npm audit --omit=dev`) no mostró
avisos en esta revisión. La auditoría completa sí informa alertas en la cadena
de dependencias del linter de desarrollo; no se aplicó `npm audit fix --force`,
que propone un cambio mayor incompatible de configuración de Next/ESLint.
Esto no equivale a garantizar que no existan vulnerabilidades.
