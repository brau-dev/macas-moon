import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getPool, getBooking, bookingColumns, releaseExpiredNights, transaction, type Booking } from "@/lib/booking-db";
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
    // Tilopay may no longer return detail after a link is deleted. Expiration
    // must not depend on that API succeeding, or pending rows would live forever.
    // Only elapsed holds are released, under the same locks as new allocations.
    await transaction(releaseExpiredNights);
    const pending = await getPool().query<{ id: string; verify_payment: boolean }>(`SELECT id,
      (status = 'pending' OR (payment_issue IS NULL AND created_at > now() - interval '7 days'
        AND (status = 'expired' OR cancelled_from_status IN ('pending','expired')))) AS verify_payment
      FROM reservations
      WHERE payment_provider = 'tilopay' AND payment_environment = $1 AND
        (status = 'pending' OR (status IN ('expired','cancelled') AND
          ((created_at > now() - interval '7 days' AND payment_issue IS NULL
            AND (status = 'expired' OR cancelled_from_status IN ('pending','expired'))) OR
           (payment_link_id IS NOT NULL AND payment_link_closed_at IS NULL AND payment_link_consumed_at IS NULL
             AND (payment_link_checked_at IS NULL OR payment_link_checked_at < now() - interval '2 minutes')))))
      ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
        CASE WHEN status = 'pending' OR (payment_issue IS NULL AND created_at > now() - interval '7 days'
          AND (status = 'expired' OR cancelled_from_status IN ('pending','expired')))
          THEN payment_checked_at ELSE payment_link_checked_at END ASC NULLS FIRST,
        created_at, id LIMIT 20`, [process.env.TILOPAY_EXPECTED_ENVIRONMENT]);
    let failures = 0;
    let checked = 0;
    let emailRetries = 0;
    const deadline = Date.now() + 18_000;
    for (const row of pending.rows) {
      if (Date.now() > deadline) break;
      checked++;
      // A recorded late-payment incident requires human action, not repeated
      // consultations of the same approved charge. It remains visible in admin.
      try { if (row.verify_payment) await reconcilePayment(row.id); }
      catch (error) { failures++; logServerError("Payment reconciliation failed", error); }
      // Link cleanup is independent of payment-check failures and of the hold:
      // at its own deadline close the pending link without releasing nights.
      // Retry failed closures, including older links and late-payment incidents.
      try {
        const current = await getBooking(row.id);
        if (current) await closeInactivePaymentLink(current);
      }
      catch (error) { failures++; logServerError("Expired payment link cleanup failed", error); }
    }
    const unsent = await getPool().query<Booking>(`SELECT ${bookingColumns}
      FROM reservations WHERE kind = 'booking' AND status = 'confirmed' AND payment_environment = $1 AND
        (confirmation_email_sent_at IS NULL OR (owner_notification_required AND owner_notification_sent_at IS NULL))
      ORDER BY confirmed_at LIMIT 50`, [process.env.TILOPAY_EXPECTED_ENVIRONMENT]);
    for (const row of unsent.rows) {
      if (Date.now() > deadline) break;
      emailRetries++;
      try { await sendConfirmation(row); }
      catch (error) { failures++; logServerError("Confirmation email retry failed", error); }
    }
    return NextResponse.json({ checked, emailRetries, failures });
  } catch (error) {
    logServerError("Scheduled reconciliation failed", error);
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 503 });
  }
}
