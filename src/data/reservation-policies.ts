export const bookingPolicyVersion = "2026-11-15";
export const refundPolicy = "Las noches confirmadas no son reembolsables. Si necesitas ayuda o tienes dudas, contacta a Macas Moon Glamping.";

export const bookingConditions = [
  { title: "Antes de reservar", text: "Comprueba el domo, las fechas, la cantidad de huéspedes y el importe total antes de pagar. La fecha de salida no cuenta como noche de estancia." },
  { title: "Confirmación y pago", text: "Enviar una solicitud no confirma la reserva. La confirmación se realiza después de verificar el pago. Si el proceso no se completa dentro del plazo de la solicitud, las fechas vuelven a estar disponibles." },
  { title: "Cancelaciones y reembolsos", text: refundPolicy },
  { title: "Ayuda y cambios", text: "Contacta a la empresa e indica tu referencia de reserva para solicitar ayuda, cancelar o consultar un cambio. Las solicitudes de cambio se revisan según disponibilidad y no garantizan una modificación ni un reembolso de noches confirmadas." },
  { title: "Cobro sin confirmación", text: "Si ves un cobro aprobado y no recibes la confirmación de tu reserva, contacta a la empresa con tu referencia y el comprobante. No repitas el pago. El equipo revisará el caso; un cobro sin reserva confirmada requiere una revisión específica." },
  { title: "Alcance de las condiciones", text: "Estas condiciones corresponden a las reservas directas realizadas en esta web y se aplican sin perjuicio de los derechos que reconozca la normativa aplicable." },
] as const;

export const privacySections = [
  { title: "Quién gestiona tus datos", text: "El responsable del tratamiento de tus datos es Christian Salazar, de Macas Moon Glamping, en Monteverde, Puntarenas, Costa Rica. Utilizamos la información que facilitas para gestionar tus solicitudes y estancias. Puedes contactarnos por los medios indicados al final de esta página." },
  { title: "Información que recopilamos", text: "Recopilamos tu nombre, correo electrónico, teléfono, país de residencia, domo, fechas, número de huéspedes, importe y referencias y estados del pago. También conservamos la versión y fecha de aceptación de estas condiciones y el historial necesario para atender la reserva y sus incidencias." },
  { title: "Para qué usamos la información", text: "Usamos tus datos para comprobar disponibilidad, tramitar y confirmar la reserva, comunicarnos contigo y revisar pagos o incidencias. El equipo recibe avisos de la reserva por correo con el nombre, domo, fechas y número de huéspedes. Esta aceptación no autoriza comunicaciones de publicidad." },
  { title: "Proveedores y acceso", text: "Solo el personal autorizado debe acceder a la información de las reservas. Utilizamos Netlify para alojar la web y su base de datos, Tilopay para los pagos, Cloudflare para proteger el formulario, Gmail para los correos. Estos servicios pueden procesar información fuera de Costa Rica. Los calendarios públicos de disponibilidad no incluyen tus datos personales." },
  { title: "Datos de tarjeta", text: "Los datos de tarjeta se introducen en la página de Tilopay. Nuestro formulario de reserva no solicita ni guarda el número completo de la tarjeta ni su código de seguridad." },
  { title: "Conservación y solicitudes", text: "Los registros se conservan para atender la estancia, sus incidencias y las obligaciones aplicables. Puedes solicitar acceso, corrección, eliminación o revisión del uso de tus datos por correo o WhatsApp. La empresa evaluará la solicitud y cualquier obligación de conservación que corresponda; podrá pedir información para verificar tu identidad." },
  { title: "Tu elección", text: "Los campos marcados como obligatorios son necesarios para tramitar la reserva en línea. Si no deseas facilitarlos o autorizar este tratamiento, puedes contactar a la empresa para consultar alternativas. Puedes solicitar la revocación del consentimiento para usos futuros, sin cambiar las actuaciones realizadas previamente ni las obligaciones aplicables." },
  { title: "Preferencias y protección del formulario", text: "Guardamos el idioma que elijas en el almacenamiento local de tu navegador. La protección del formulario utiliza Cloudflare Turnstile y puede procesar información técnica del dispositivo y la conexión. Puedes borrar las preferencias desde tu navegador." },
] as const;
