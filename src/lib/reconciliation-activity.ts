import { randomUUID } from "node:crypto";
import { getStore } from "@netlify/blobs";

export const IDLE_RECONCILIATION_MS = 60 * 60 * 1000;

export function reconciliationActivityKey() {
  return process.env.TILOPAY_EXPECTED_ENVIRONMENT === "Production" ? "production" : "test";
}

export function reconciliationActivityStore() {
  if (!process.env.SITE_ID) return null;
  return getStore({
    name: "booking-reconciliation",
    consistency: "strong",
    // The SDK retries network failures and 5xx responses over several seconds.
    // Return a non-retryable failure so this hint cannot eat the worker's budget.
    fetch: async (input, init) => {
      try {
        const response = await fetch(input, { ...init, cache: "no-store", signal: AbortSignal.timeout(2_000) });
        if (response.status !== 429 && response.status < 500) return response;
        await response.body?.cancel();
      } catch {
        return Response.error();
      }
      return Response.error();
    },
  });
}

export async function wakeReconciliation() {
  if (process.env.BOOKING_RECONCILE_ENABLED !== "true") return;
  // Use a different value for every signal so a concurrent empty run cannot
  // overwrite it with the version read before this booking was committed.
  await reconciliationActivityStore()?.setJSON(reconciliationActivityKey(), { generation: randomUUID() });
}
