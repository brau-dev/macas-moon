import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPool, getBooking, bookingColumns, type Booking } from "@/lib/booking-db";
import { reconcilePayment } from "@/lib/reservation-service";
import { sendConfirmation } from "@/lib/booking-email";
import { closeInactivePaymentLink } from "@/lib/tilopay";
import { logServerError } from "@/lib/safe-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.BOOKING_RECONCILE_ENABLED !== "true") return new Response(null, { status: 204 });
  const expected = process.env.BOOKING_RECONCILE_SECRET;
  const received = request.headers.get("x-reconcile-secret") ?? "";
  if (!expected || expected.length < 32 || Buffer.byteLength(received) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
    return new Response(null, { status: 404 });
  }
  try {
    const pending = await getPool().query<{ id: string; verify_payment: boolean }>(`SELECT id,
      (status = 'pending' OR (payment_issue IS NULL AND created_at > now() - interval '7 days'
        AND (status = 'expired' OR cancelled_from_status IN ('pending','expired')))) AS verify_payment
      FROM reservations
      WHERE payment_provider = 'tilopay' AND
        (status = 'pending' OR (status IN ('expired','cancelled') AND
          ((created_at > now() - interval '7 days' AND payment_issue IS NULL
            AND (status = 'expired' OR cancelled_from_status IN ('pending','expired'))) OR
           (payment_link_id IS NOT NULL AND payment_link_closed_at IS NULL))))
      ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
        payment_checked_at ASC NULLS FIRST, created_at LIMIT 20`);
    let failures = 0;
    const deadline = Date.now() + 18_000;
    for (const row of pending.rows) {
      if (Date.now() > deadline) break;
      // A recorded late-payment incident requires human action, not repeated
      // consultations of the same approved charge. It remains visible in admin.
      try { if (row.verify_payment) await reconcilePayment(row.id); }
      catch (error) { failures++; logServerError("Payment reconciliation failed", error); }
      // Link cleanup is independent: even a late-payment warning must not skip
      // closing an expired link. Retry failed closures, including older links.
      try {
        const current = await getBooking(row.id);
        if (current) await closeInactivePaymentLink(current);
      }
      catch (error) { failures++; logServerError("Expired payment link cleanup failed", error); }
    }
    const unsent = await getPool().query<Booking>(`SELECT ${bookingColumns}
      FROM reservations WHERE kind = 'booking' AND status = 'confirmed' AND
        (confirmation_email_sent_at IS NULL OR (owner_notification_required AND owner_notification_sent_at IS NULL))
      ORDER BY confirmed_at LIMIT 50`);
    for (const row of unsent.rows) {
      if (Date.now() > deadline) break;
      try { await sendConfirmation(row); }
      catch (error) { failures++; logServerError("Confirmation email retry failed", error); }
    }
    return NextResponse.json({ checked: pending.rows.length, emailRetries: unsent.rows.length, failures });
  } catch (error) {
    logServerError("Scheduled reconciliation failed", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 503 });
  }
}
