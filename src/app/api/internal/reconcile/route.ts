import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPool, type Booking } from "@/lib/booking-db";
import { reconcilePayment } from "@/lib/reservation-service";
import { sendConfirmation } from "@/lib/booking-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.BOOKING_RECONCILE_SECRET;
  const received = request.headers.get("x-reconcile-secret") ?? "";
  if (!expected || expected.length < 24 || received.length !== expected.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    return new Response(null, { status: 404 });
  }
  try {
    const pending = await getPool().query<{ id: string }>(`SELECT id FROM reservations
      WHERE status = 'pending' AND payment_provider = 'tilopay'
      ORDER BY created_at LIMIT 50`);
    let failures = 0;
    for (const row of pending.rows) {
      try { await reconcilePayment(row.id); }
      catch (error) { failures++; console.error("Payment reconciliation failed", row.id, error); }
    }
    const unsent = await getPool().query<Booking>(`SELECT id, dome, check_in::text, check_out::text,
      guests, guest_name, guest_email, guest_phone, billing_address, billing_city, billing_state,
      billing_postal_code, billing_country, status, amount_cents, currency, payment_provider,
      payment_reference, expires_at, confirmation_email_sent_at
      FROM reservations WHERE status = 'confirmed' AND confirmation_email_sent_at IS NULL
      ORDER BY confirmed_at LIMIT 50`);
    for (const row of unsent.rows) {
      try { await sendConfirmation(row); }
      catch (error) { failures++; console.error("Confirmation email retry failed", row.id, error); }
    }
    return NextResponse.json({ checked: pending.rows.length, emailRetries: unsent.rows.length, failures });
  } catch (error) {
    console.error("Scheduled reconciliation failed", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 503 });
  }
}
