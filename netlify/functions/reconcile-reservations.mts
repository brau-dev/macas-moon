async function reconcileReservations() {
  if (process.env.BOOKING_RECONCILE_ENABLED !== "true") {
    return new Response(null, { status: 204 });
  }
  const siteUrl = process.env.URL;
  const secret = process.env.BOOKING_RECONCILE_SECRET;
  if (!siteUrl || !secret) throw new Error("Booking reconciliation is not configured");
  const response = await fetch(`${siteUrl.replace(/\/$/, "")}/api/internal/reconcile`, {
    method: "POST", headers: { "x-reconcile-secret": secret }, signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Booking reconciliation HTTP ${response.status}`);
  if (response.status !== 204) {
    const result = await response.json() as { failures?: number };
    if (!Number.isSafeInteger(result.failures) || result.failures! < 0) throw new Error("Invalid booking reconciliation report");
    if (result.failures) console.warn("Reservation reconciliation completed with pending operations", { failures: result.failures });
  }
  return new Response(null, { status: 204 });
}

export default reconcileReservations;

// Webhook and return verify immediately; this is a fallback, not iCal polling.
export const config = { schedule: "*/5 * * * *" };
