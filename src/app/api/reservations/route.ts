import { NextResponse } from "next/server";
import { BookingError, startReservation } from "@/lib/reservation-service";
import { requireSameOrigin } from "@/lib/admin-auth";
import { readJsonObject } from "@/lib/request-body";
import { logServerError } from "@/lib/safe-log";
import { randomUUID } from "node:crypto";
import { CheckoutError, checkoutPublicMessage } from "@/lib/checkout-error";

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
    const requestId = randomUUID();
    logServerError("Reservation failed", error, requestId);
    const status = error instanceof CheckoutError &&
      ["security", "tilopay_auth", "tilopay_link"].includes(error.stage) ? 502 : 500;
    return NextResponse.json({ error: checkoutPublicMessage(error), requestId },
      { status, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
  }
}
