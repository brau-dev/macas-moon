# Deploy casi final: ambos domos y Tilopay Test

## Qué se mantiene

- Proyecto: **macasmoon-reservas-testing**, rama **feature/reservas**. No tocar `main` ni el sitio principal.
- URL: **https://macasmoon-reservas-testing.netlify.app**.
- Ambos domos: precio base **US$170 por noche**, pago obligatorio. Los dueños pueden
  definir precios distintos por fecha desde `/admin → Editar precios`.
- `TILOPAY_EXPECTED_ENVIRONMENT=Test`, comercio de Tilopay también en Test.
- `TILOPAY_CHECKOUT_ENABLED=true`, `NEXT_PUBLIC_BOOKING_TEST_MODE=false` y `BOOKING_RECONCILE_ENABLED=true`.
- Sin nuevas cuentas, contraseñas ni variables obligatorias.

## Antes de publicar: una sola preparación

1. Ejecuta `npm run check:deploy`. Verifica configuración, pruebas con proveedores
   simulados, lint, compilación, tipos y exposición de secretos. No publica ni cobra.
2. En Netlify abre **macasmoon-reservas-testing → Project configuration → Environment variables**
   e importa **todo el `.env.netlify` actual**. No lo añadas a Git ni lo pegues en el chat.
   Actualiza conflictos: ambos domos en `BOOKING_ACTIVE_DOMES`, ambas tarifas `17000`
   y los cuatro iCal privados. El push no importa este archivo.
3. Puedes usar **Same value for all deploy contexts** en este proyecto separado de
   pruebas. El contexto **Production de Netlify** corresponde a su URL principal;
   no significa cambiar Tilopay a Producción.
4. Los secretos necesitan alcance **Functions**; las claves `NEXT_PUBLIC_*` también
   **Builds**. No marques `SMTP_USER` ni la clave pública Turnstile como secretos.
   No sobrescribas `URL`, `SITE_ID` o `NETLIFY_DB_URL`, que suministra Netlify.
5. Revisa tus cambios, haz tú el commit y el push cuando estés conforme. Publica
   esta rama solo en el proyecto de pruebas. El agente no hace commits ni deploys.
6. Comprueba que Netlify aplique las migraciones pendientes **0001 a 0007** antes
   de publicar. Las nuevas son 0005 (estado/diagnóstico de enlaces), 0006 (entorno
   histórico del pago) y 0007 (precios por noche). No borres tablas ni pegues SQL en variables de entorno.
   Con Netlify Database nativo están en `netlify/database/migrations`; si gestionas
   SQL manualmente, aplica los archivos pendientes de `db/` en orden antes de publicar.
   [Migraciones nativas de Netlify](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/).
7. Ejecuta `npm run check:published`: debe confirmar ambos domos, precios e iCal.
   No crea reservas. Si falla, no hagas otra compra para intentar arreglarlo.

## Pruebas de aceptación en este mismo deploy

Usa exclusivamente las tarjetas ficticias oficiales de Tilopay y confirma el modo
Test del comercio. El indicador de nuestra web no cambia la cuenta de Tilopay.

- **Una reserva por cada domo:** fechas libres acordadas con los dueños, contacto
  válido y país. Debe abrir Tilopay, volver a la web, confirmar la reserva y enviar
  dos correos separados: huésped y negocio. Revisar spam. Solo entonces debe aparecer
  la estancia en el iCal del domo correcto, nunca el nombre ni correo del huésped.
- **Rechazo y abandono:** no deben confirmarse ni exportarse como reservas pagadas.
  Las noches pendientes de la web vencen a los 30 minutos. El respaldo de 15 minutos
  comprueba y gestiona enlaces; no se promete una hora exacta si Tilopay falla.
- **Reservas antiguas:** `/admin → domo → mes → Mostrar historial → Revisar enlace de pago`.
  El pago ya consumido debe quedar identificado como tal, o Tilopay debe confirmar
  el cierre. Un error debe mostrar diagnóstico seguro; no se da por cerrado un enlace
  solo porque la reserva esté anulada o por la etiqueta «Pendiente de pago» de Tilopay.
- **Administrador:** comprobar ambos calendarios, cuadro de detalles al pulsar una
  noche, bloqueo manual y «Liberar fechas», incluyendo liberación parcial de un
  bloqueo. Una anulación conserva el historial y no hace reembolsos automáticos.
- **Precios por fecha:** seguir [esta comprobación](precios-por-fecha.md). Guardar
  un precio para varias noches, comprobar el total público y restaurar la tarifa
  base. Los cambios no modifican reservas ni enlaces de pago anteriores.
- **Airbnb y Expedia:** verificar importación de los dos enlaces de abajo en sus
  respectivos anuncios. No desconectar/reconectar para forzar actualización. Expedia
  puede requerir reapertura manual tras retirar un cierre; iCal conserva retrasos y
  riesgo residual de reservas dobles, ya aceptados por los dueños.
- **Móvil y billeteras:** probar el formulario y la pasarela desde los dispositivos
  previstos. Apple Pay/Google Pay dependen de su activación en Tilopay, del navegador
  y del dispositivo; el código de esta web no activa esos servicios del comercio.

No necesitas otro deploy para repetir estas pruebas. Si alguna falla, todavía no
hay aprobación final para ventas reales: se diagnostica antes de cambiar de modo.

## El siguiente deploy: pasar a cobros reales, sin cambios de código previstos

1. Resolver todos los enlaces Test pendientes mientras el comercio siga en Test.
2. Identificar y liberar desde `/admin` las noches ficticias de estas pruebas.
   Conservar el historial; no truncar la base ni borrar reservas indiscriminadamente.
   Comprobar también las reaperturas en Expedia/Airbnb.
3. Verificar con Tilopay la habilitación comercial y de los métodos de pago deseados.
   Desactivar Test **en el portal de Tilopay** y cambiar en Netlify
   `TILOPAY_EXPECTED_ENVIRONMENT=Production`. Mantener pago obligatorio, respaldo y
   tarifas. Usar las credenciales que correspondan al comercio habilitado; no se asume
   que una variable de la web cambie el modo del proveedor.
   [Entornos de Tilopay](https://tilopay.com/developers/entornos).
4. Ejecutar `npm run check:netlify-env -- --production` contra un archivo local privado
   con esos valores, e importar la configuración definitiva. No cambies el archivo a
   Producción hasta decidirlo. Rotar previamente cualquier secreto que se haya compartido.
5. Publicar la misma revisión de código con la configuración final. El historial
   Test seguirá identificado como «sin cargo real»; sus enlaces no se consultan ni
   modifican con el entorno de Producción. La 0006 ya habrá quedado aplicada.
6. Verificar después un cobro real autorizado y sus correos; una prueba simulada no
   demuestra la liquidación bancaria ni la disponibilidad real de las billeteras.

Si también cambias a **macasmoon.com** o a otro proyecto/base, no será únicamente
desactivar Test: habrá que configurar ese proyecto/dominio, Turnstile, migraciones
y enlaces importados. Estos pasos no se hacen automáticamente ni están autorizados aquí.

## Enlaces públicos para importar en las plataformas

- Amplio: `https://macasmoon-reservas-testing.netlify.app/api/calendar/domo-amplio/calendar.ics`
- Romántico: `https://macasmoon-reservas-testing.netlify.app/api/calendar/domo-romantico/calendar.ics`

No contienen datos de huéspedes ni exportan de nuevo los cierres importados de otras
plataformas. Una reserva del día 10 al 11 ocupa solo la noche del 10.
