import { NextResponse } from "next/server";
import { BookingError, startReservation } from "@/lib/reservation-service";
import { requireSameOrigin } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/request-body";
import { logServerError } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = await readJsonObject(request);
    const result = await startReservation(body, request.headers.get("x-booking-test-secret"), new URL(request.url).origin);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BookingError) return NextResponse.json({ error: error.message }, { status: error.status });
    logServerError("Reservation failed", error);
    return NextResponse.json({ error: "No se pudo iniciar la reserva. Intenta de nuevo." }, { status: 500 });
  }
}
