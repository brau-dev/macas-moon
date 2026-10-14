import { NextResponse } from "next/server";
import { cancelTestBooking } from "@/lib/test-bookings";
import { testSecretAuthorized } from "@/lib/test-mode";
import { validReservationId } from "@/lib/booking-validation";
import { logServerError } from "@/lib/safe-log";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supplied = request.headers.get("x-booking-test-secret");
  if (!testSecretAuthorized(new URL(request.url).origin, supplied)) {
    return new Response(null, { status: 404 });
  }
  if (!validReservationId(id)) return NextResponse.json({ error: "Reserva inválida" }, { status: 400 });
  try {
    const cancelled = await cancelTestBooking(id);
    return NextResponse.json({ cancelled }, { status: cancelled ? 200 : 409 });
  } catch (error) {
    logServerError("Test booking cancellation failed", error);
    return NextResponse.json({ error: "No se pudo cancelar la prueba" }, { status: 503 });
  }
}
