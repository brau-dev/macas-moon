# Precios por fecha desde el administrador

## Cómo cambiar varias noches de una sola vez

1. Entra a `/admin` con tu usuario y contraseña.
2. Escoge **Domo Amplio** o **Domo Romántico**.
3. Pulsa **Editar precios**, encima del calendario.
4. Pulsa la primera noche y después la última. Se seleccionan también todas las
   noches intermedias. Puedes pasar de mes entre ambos clics. Para una sola noche,
   basta un clic. También puedes escribir las fechas en el formulario lateral.
5. En **Precio por noche (USD)** escribe el importe que quieras, por ejemplo `200`
   o `200,50`. Pulsa **Aplicar precio a las noches seleccionadas**.

La primera y la última noche están incluidas. Por ejemplo, del 24 al 26 de
diciembre a US$200 cambia las noches del 24, 25 y 26. No significa salida el 26:
esta selección es de precios, no de estancia. Puedes cambiar hasta 365 noches por
operación. Haz otra selección para asignarle otro precio.

**Restablecer precio base en este rango** quita las tarifas especiales de las
noches seleccionadas; vuelven al precio base configurado, actualmente US$170.
No cancela reservas, no libera noches y no modifica otros domos.

## Qué verá el huésped

- El calendario de reservas muestra el precio de cada noche disponible.
- Al elegir llegada y salida, muestra el total y un desglose de las noches.
  La salida no se cobra como una noche adicional.
- Los precios los fija el administrador: no hay reglas automáticas por demanda,
  temporada o fines de semana. El servidor únicamente suma esos precios.
- Antes de crear el enlace de pago, el servidor vuelve a comprobar las tarifas.
  Si cambiaron, no crea el pago: pide revisar el total actualizado y continuar otra vez.
- Las reservas y los enlaces de pago **ya creados** conservan su importe original,
  incluso si aún están pendientes. Cambiar precios no recalcula reservas anteriores.

Los cambios son solo para la página web. **iCal sincroniza disponibilidad, no
precios.** Las tarifas de Airbnb y Expedia se ajustan en esas plataformas.

## Antes de desplegar esta mejora

Es necesaria la migración **0007_nightly_prices.sql**, además de las anteriores.
Con Netlify Database nativo está en `netlify/database/migrations/`. Si administras
las migraciones manualmente, ejecuta `db/007_nightly_prices.sql` en el editor SQL
de la base correspondiente, después de las anteriores. No la pegues en variables
de entorno. No hay variables ni servicios nuevos.

Si no se pueden leer las tarifas, el sistema no abre un pago suponiendo el precio
base. Muestra un error y mantiene la reserva deshabilitada hasta poder verificarlas.

## Comprobación en el mismo deploy, sin publicar otra vez

1. Elige tres noches futuras libres y asigna un mismo precio desde `/admin`.
2. Abre `/reservar` en otra pestaña y pulsa **Actualizar disponibilidad y precios**.
   Verifica el importe de cada noche y el total, también mezclando una noche de
   precio especial con otra de precio base.
3. Cambia al otro domo: sus precios no deben haber cambiado.
4. Deja abierto un formulario con el total anterior y modifica esas tarifas en
   el administrador. Al intentar continuar con el importe antiguo, debe pedir
   revisar el precio actualizado, sin crear un pago por ese importe anterior.
5. Completa una reserva con el comercio Tilopay en **Test**, usando solo sus datos
   ficticios autorizados. El importe debe coincidir con el desglose.
6. Cambia de nuevo las tarifas: la reserva anterior debe conservar su importe.
7. Restablece el precio base de las fechas que usaste para esta comprobación.

Estas pruebas no requieren cambiar Tilopay a Producción ni cambiar el dominio.
