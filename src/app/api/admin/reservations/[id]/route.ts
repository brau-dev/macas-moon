import { NextResponse } from "next/server";
import { requireAdmin, requireSameOrigin } from "@/lib/admin-auth";
import { adminError, privateHeaders, readAdminJson } from "@/lib/admin-http";
import { BookingError } from "@/lib/booking-error";
import { cancelLocalReservation } from "@/lib/admin-cancellation";
import { reconcilePayment } from "@/lib/reservation-service";
import { getBooking } from "@/lib/booking-db";
import { sendConfirmation } from "@/lib/booking-email";
import { validReservationId } from "@/lib/booking-validation";
import { closeInactivePaymentLink } from "@/lib/tilopay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(request);
    await requireAdmin();
    const { id } = await context.params;
    if (!validReservationId(id)) throw new BookingError("Reserva inválida.", 400);
    const body = await readAdminJson(request);
    const { action } = body;
    if (action === "cancel") {
      const result = await cancelLocalReservation(id, body, process.env.ADMIN_USERNAME!);
      return NextResponse.json({ ok: true, ...result }, { headers: privateHeaders });
    } else if (action === "cancel-test") {
      const booking = await getBooking(id);
      if (!booking || booking.payment_provider !== "test") throw new BookingError("No se encontró una reserva sin cobro.", 409);
      const result = await cancelLocalReservation(id, { dome: booking.dome,
        reason: body.reason ?? "Anulación administrativa de reserva sin cobro", acknowledged: true }, process.env.ADMIN_USERNAME!);
      return NextResponse.json({ ok: true, ...result }, { headers: privateHeaders });
    } else if (action === "retry-payment-link") {
      const booking = await getBooking(id);
      if (!booking || booking.dome !== body.dome) throw new BookingError("Reserva no encontrada en este domo.", 404);
      if (booking.payment_provider !== "tilopay" || !["cancelled", "expired"].includes(booking.status)) {
        throw new BookingError("Solo se revisan enlaces de solicitudes vencidas o reservas anuladas.", 409);
      }
      if (booking.payment_environment !== process.env.TILOPAY_EXPECTED_ENVIRONMENT) {
        throw new BookingError("El enlace pertenece a otro entorno de pago. No se consultó ni modificó; revisa su entorno original en Tilopay.", 409);
      }
      try { await closeInactivePaymentLink(booking); }
      catch {
        return NextResponse.json({ error: "No se pudo completar la revisión con Tilopay. La reserva no cambió; consulta la información para soporte de su ficha." },
          { status: 502, headers: privateHeaders });
      }
      const current = await getBooking(id);
      const warning = current?.payment_link_consumed_at
        ? "Tilopay confirma que el enlace es de un solo uso y su pago está verificado. La reserva permanece anulada; no se realizó un reembolso."
        : current?.payment_link_closed_at ? "Enlace cerrado en Tilopay. La reserva no cambió y no se realizó un reembolso."
          : "La revisión ya está en curso o hubo un intento reciente. Espera dos minutos antes de volver a intentarlo. La reserva no cambió.";
      return NextResponse.json({ ok: true, warning }, { headers: privateHeaders });
    } else if (action === "reconcile") {
      await reconcilePayment(id);
    } else if (action === "retry-email") {
      const booking = await getBooking(id);
      if (!booking || !await sendConfirmation(booking)) throw new BookingError("Correos ya enviados, reserva no confirmada o remitente no configurado.", 409);
    } else throw new BookingError("Acción no permitida.", 400);
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (error) { return adminError(error); }
}
