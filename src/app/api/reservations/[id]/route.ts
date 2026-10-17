import { NextResponse } from "next/server";
import { getBooking } from "@/lib/booking-db";
import { reconcilePayment } from "@/lib/reservation-service";
import { validReservationId } from "@/lib/booking-validation";
import { logServerError } from "@/lib/safe-log";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!validReservationId(id)) return NextResponse.json({ error: "Reserva inválida" }, { status: 400 });
  try {
    const booking = await getBooking(id);
    if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    const current = booking.status === "pending" && booking.payment_provider === "tilopay" &&
      booking.payment_environment === process.env.TILOPAY_EXPECTED_ENVIRONMENT
      ? await reconcilePayment(id) : booking;
    const status = current.status === "pending" && current.expires_at && current.expires_at.valueOf() <= Date.now() ? "expired" : current.status;
    return NextResponse.json({ id, status, dome: current.dome,
      checkIn: current.check_in, checkOut: current.check_out, amountCents: current.amount_cents,
      currency: current.currency, testMode: current.payment_provider === "test",
      simulatedPayment: current.payment_provider === "test" || current.payment_environment !== "Production",
      emailSent: Boolean(current.confirmation_email_sent_at) },
    { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const requestId = randomUUID();
    logServerError("Reservation status failed", error, requestId);
    return NextResponse.json({ error: "No se pudo verificar el pago. Si Tilopay ya lo aprobó, no vuelvas a pagar; actualiza el estado o contacta al alojamiento.", requestId },
      { status: 503, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
  }
}
