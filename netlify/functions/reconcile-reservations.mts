async function reconcileReservations() {
  if (process.env.BOOKING_RECONCILE_ENABLED !== "true") {
    return new Response(null, { status: 204 });
  }
  const siteUrl = process.env.BOOKING_SITE_URL;
  const secret = process.env.BOOKING_RECONCILE_SECRET;
  if (!siteUrl || !secret) throw new Error("Booking reconciliation is not configured");
  const response = await fetch(`${siteUrl.replace(/\/$/, "")}/api/internal/reconcile`, {
    method: "POST", headers: { "x-reconcile-secret": secret }, signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Booking reconciliation HTTP ${response.status}`);
  return new Response(null, { status: 204 });
}

export default reconcileReservations;

export const config = { schedule: "*/2 * * * *" };
