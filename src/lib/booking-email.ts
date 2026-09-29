import { Resend } from "resend";
import { getDome } from "@/data/domes";
import { markEmailSent, type Booking } from "@/lib/booking-db";

export async function sendConfirmation(booking: Booking) {
  if (booking.confirmation_email_sent_at || !process.env.RESEND_API_KEY || !process.env.BOOKING_EMAIL_FROM) return false;
  const dome = getDome(booking.dome);
  const label = dome?.name ?? booking.dome;
  const total = new Intl.NumberFormat("es-CR", { style: "currency", currency: booking.currency })
    .format(booking.amount_cents / 100);
  const text = [
    `Hola ${booking.guest_name},`,
    "Tu reserva en Macas Moon está confirmada.",
    `Número de reserva: ${booking.id}`,
    `Domo: ${label}`,
    `Llegada: ${booking.check_in}`,
    `Salida: ${booking.check_out}`,
    `Huéspedes: ${booking.guests}`,
    `Importe pagado: ${booking.payment_provider === "test" ? "Prueba sin cobro" : total}`,
    "Este comprobante de reserva no es una factura electrónica tributaria.",
    "Para consultas, responde a este correo.",
  ].join("\n");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.BOOKING_EMAIL_FROM,
    to: booking.guest_email,
    subject: `Reserva confirmada · Macas Moon · ${booking.id.slice(0, 8)}`,
    text,
    replyTo: process.env.BOOKING_REPLY_TO,
  }, { idempotencyKey: `booking-confirmed/${booking.id}` });
  if (error) throw new Error(`Confirmation email failed: ${error.message}`);
  await markEmailSent(booking.id);
  return true;
}
