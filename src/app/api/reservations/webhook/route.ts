import { NextResponse } from "next/server";
import { getPool } from "@/lib/booking-db";
import { reconcilePayment } from "@/lib/reservation-service";
import { readJsonObject } from "@/lib/request-body";
import { BookingError } from "@/lib/booking-error";
import { logServerError } from "@/lib/safe-log";
import { signedWebhookCandidate } from "@/lib/tilopay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let data: Record<string, unknown>;
  try { data = await readJsonObject(request); }
  catch (error) { return new Response(null, { status: error instanceof BookingError ? error.status : 400 }); }
  const reference = data.orderNumber ?? data.order;
  const linkId = data.tilopayLinkId;
  const validLinkId = (typeof linkId === "number" || typeof linkId === "string") && /^[1-9]\d{0,15}$/.test(String(linkId));
  const validReference = typeof reference === "string" && /^MM[A-F0-9]{32}$/.test(reference);
  if (!validLinkId && !validReference) {
    return new Response(null, { status: 400 });
  }
  try {
    const result = await getPool().query<{ id: string }>(
      `SELECT id FROM reservations WHERE payment_environment = $3 AND payment_provider = 'tilopay'
       AND ($1::text IS NULL OR payment_link_id = $1) AND ($2::text IS NULL OR payment_reference = $2)`,
      [validLinkId ? String(linkId) : null, validReference ? reference : null, process.env.TILOPAY_EXPECTED_ENVIRONMENT]);
    const booking = result.rows[0];
    if (booking) {
      const candidate = validLinkId
        ? signedWebhookCandidate(booking.id, new URL(request.url).searchParams.get("token"), data)
        : undefined;
      await reconcilePayment(booking.id, candidate);
    }
    // Webhook content alone cannot confirm a booking: reconcilePayment queries Tilopay.
    return new Response(null, { status: 200 });
  } catch (error) {
    // A verified late payment is already recorded for the administrator.
    if (error instanceof BookingError && error.status === 409) return new Response(null, { status: 200 });
    logServerError("Tilopay webhook reconciliation failed", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 503 });
  }
}
