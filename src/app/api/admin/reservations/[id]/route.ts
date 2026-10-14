import { NextResponse } from "next/server";
import { requireAdmin, requireSameOrigin } from "@/lib/admin-auth";
import { adminError, privateHeaders, readAdminJson } from "@/lib/admin-http";
import { BookingError } from "@/lib/booking-error";
import { cancelTestBooking } from "@/lib/test-bookings";
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
    const { action } = await readAdminJson(request);
    if (action === "cancel-test") {
      if (!await cancelTestBooking(id)) throw new BookingError("No se encontró una reserva de prueba confirmada.", 409);
    } else if (action === "reconcile") {
      await reconcilePayment(id);
    } else if (action === "retry-email") {
      const booking = await getBooking(id);
      if (!booking || !await sendConfirmation(booking)) throw new BookingError("Correos ya enviados, reserva no confirmada o remitente no configurado.", 409);
    } else throw new BookingError("Acción no permitida.", 400);
    return NextResponse.json({ ok: true }, { headers: privateHeaders });
  } catch (error) { return adminError(error); }
}
