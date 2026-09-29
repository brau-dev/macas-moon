import { NextResponse } from "next/server";
import { BookingError, startReservation } from "@/lib/reservation-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 10_000) {
    return NextResponse.json({ error: "Solicitud demasiado grande." }, { status: 413 });
  }
  try {
    const body = await request.json();
    const result = await startReservation(body, request.headers.get("x-booking-test-secret"), new URL(request.url).origin);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Reservation failed", error);
    return NextResponse.json({ error: "No se pudo iniciar la reserva. Intenta de nuevo." }, { status: 500 });
  }
}
