import {
  IDLE_RECONCILIATION_MS, reconciliationActivityKey, reconciliationActivityStore,
} from "../../src/lib/reconciliation-activity.js";

async function reconcileReservations() {
  if (process.env.BOOKING_RECONCILE_ENABLED !== "true") {
    return new Response(null, { status: 204 });
  }
  const siteUrl = process.env.URL;
  const secret = process.env.BOOKING_RECONCILE_SECRET;
  if (!siteUrl || !secret) throw new Error("Booking reconciliation is not configured");
  const key = reconciliationActivityKey();
  let store: ReturnType<typeof reconciliationActivityStore> = null;
  let etag: string | null = null;
  try {
    const activity = reconciliationActivityStore();
    if (activity) {
      const snapshot = await activity.getWithMetadata(key, { type: "json" });
      const idleUntil = snapshot?.data?.idleUntil;
      if (typeof idleUntil === "number" && idleUntil > Date.now()) return new Response(null, { status: 204 });
      store = activity;
      etag = snapshot?.etag ?? null;
    }
  } catch {
    // Run the usual database check when the idle hint is unavailable.
    console.warn("Reconciliation activity read failed");
  }
  const response = await fetch(`${siteUrl.replace(/\/$/, "")}/api/internal/reconcile`, {
    method: "POST", redirect: "error", headers: { "x-reconcile-secret": secret }, signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Booking reconciliation HTTP ${response.status}`);
  if (response.status !== 204) {
    const result = await response.json() as { failures?: number; idle?: boolean };
    if (!Number.isSafeInteger(result.failures) || result.failures! < 0) throw new Error("Invalid booking reconciliation report");
    if (result.failures) console.warn("Reservation reconciliation completed with pending operations", { failures: result.failures });
    if (store && result.idle === true && result.failures === 0) {
      try {
        await store.setJSON(key, { idleUntil: Date.now() + IDLE_RECONCILIATION_MS },
          etag === null ? { onlyIfNew: true } : { onlyIfMatch: etag });
      } catch {
        console.warn("Reconciliation activity write failed");
      }
    }
  }
  return new Response(null, { status: 204 });
}

export default reconcileReservations;

// Webhook and return verify immediately; this is a fallback, not iCal polling.
export const config = { schedule: "*/5 * * * *" };
