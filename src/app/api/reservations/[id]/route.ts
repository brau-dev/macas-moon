import { NextResponse } from "next/server";
import { getBooking } from "@/lib/booking-db";
import { reconcilePayment } from "@/lib/reservation-service";
import { validReservationId } from "@/lib/booking-validation";
import { logServerError } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validReservationId(id)) return NextResponse.json({ error: "Reserva inválida" }, { status: 400 });
  try {
    const booking = await getBooking(id);
    if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    const current = booking.status === "pending" && booking.payment_provider === "tilopay"
      ? await reconcilePayment(id) : booking;
    return NextResponse.json({ id, status: current.status, dome: current.dome,
      checkIn: current.check_in, checkOut: current.check_out, amountCents: current.amount_cents,
      currency: current.currency, testMode: current.payment_provider === "test",
      emailSent: Boolean(current.confirmation_email_sent_at) },
    { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logServerError("Reservation status failed", error);
    return NextResponse.json({ error: "No se pudo verificar el pago. Intenta de nuevo." }, { status: 503 });
  }
}
