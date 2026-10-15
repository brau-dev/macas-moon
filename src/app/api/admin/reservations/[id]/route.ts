import { NextResponse } from "next/server";
import { requireAdmin, requireSameOrigin } from "@/lib/admin-auth";
import { adminError, privateHeaders, readAdminJson } from "@/lib/admin-http";
import { BookingError } from "@/lib/booking-error";
import { cancelLocalReservation } from "@/lib/admin-cancellation";
import { reconcilePayment } from "@/lib/reservation-service";
import { getBooking } from "@/lib/booking-db";
import { sendConfirmation } from "@/lib/booking-email";
import { validReservationId } from "@/lib/booking-validation";

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
    } else if (action === "reconcile") {
      await reconcilePayment(id);
    } else if (action === "retry-email") {
      const booking = await getBooking(id);
      if (!booking || !await sendConfirmation(booking)) throw new BookingError("Correos ya enviados, reserva no confirmada o remitente no configurado.", 409);
    } else throw new BookingError("Acción no permitida.", 400);
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (error) { return adminError(error); }
}
