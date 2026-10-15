import "server-only";
import { createHash } from "node:crypto";
import { getPool, savePaymentLink, type Booking } from "@/lib/booking-db";
import { CheckoutError, checkoutStep, type CheckoutStage } from "@/lib/checkout-error";
import { trustedTilopayPaymentUrl } from "@/lib/tilopay-payment-url";
import { validDate } from "@/lib/booking-validation";
import { addDays } from "@/lib/date-range";

const API = "https://app.tilopay.com/api/v1";

async function api<T>(path: string, body: object | null, bearer?: string): Promise<T> {
  const stage: CheckoutStage = path === "login" ? "tilopay_auth"
    : path === "createLinkPayment" ? "tilopay_link" : "tilopay_check";
  return checkoutStep(stage, async () => {
    const response = await fetch(`${API}/${path}`, {
      method: body === null ? "GET" : "POST",
      headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
      body: body === null ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    // GET detail paths contain the merchant key: never put them in logs/errors.
    if (!response.ok) throw new CheckoutError(stage, "http", { upstreamStatus: response.status });
    let result: unknown;
    try { result = await response.json(); }
    catch { throw new CheckoutError(stage, "invalid_response"); }
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new CheckoutError(stage, "invalid_response");
    }
    return result as T;
  });
}

function credentials() {
  const { TILOPAY_API_USER, TILOPAY_API_PASSWORD, TILOPAY_API_KEY } = process.env;
  if (!TILOPAY_API_USER || !TILOPAY_API_PASSWORD || !TILOPAY_API_KEY) {
    throw new Error("Tilopay credentials are not configured");
  }
  return { user: TILOPAY_API_USER, password: TILOPAY_API_PASSWORD, key: TILOPAY_API_KEY };
}

let cachedToken: { fingerprint: string; value: string; expires: number } | undefined;
let tokenRequest: { fingerprint: string; promise: Promise<string> } | undefined;

async function token() {
  const { user, password } = credentials();
  const fingerprint = createHash("sha256").update(`${user}\0${password}`).digest("hex");
  if (cachedToken?.fingerprint === fingerprint && cachedToken.expires > Date.now()) return cachedToken.value;
  if (tokenRequest?.fingerprint === fingerprint) return tokenRequest.promise;
  const promise = (async () => {
    const result = await api<{ access_token?: string; expires_in?: number }>("login", { apiuser: user, password });
    if (typeof result.access_token !== "string" || !result.access_token) {
      throw new CheckoutError("tilopay_auth", "missing_token");
    }
    // Use the provider's actual lifetime, not an assumed 24-hour expiry. Cache
    // only in server memory; a cold function obtains its own token.
    if (Number.isSafeInteger(result.expires_in) && result.expires_in! > 60) {
      cachedToken = { fingerprint, value: result.access_token, expires: Date.now() + (result.expires_in! - 60) * 1000 };
    }
    return result.access_token;
  })();
  tokenRequest = { fingerprint, promise };
  try { return await promise; }
  finally { if (tokenRequest?.promise === promise) tokenRequest = undefined; }
}

export async function createPaymentUrl(booking: Booking, siteUrl: string) {
  const { key } = credentials();
  const result = await api<{ type?: string; url?: string; id?: number }>("createLinkPayment", {
    key,
    amount: (booking.amount_cents / 100).toFixed(2),
    currency: booking.currency,
    reference: booking.payment_reference,
    type: 1,
    client: booking.guest_name,
    description: `Macas Moon · ${booking.dome} · ${booking.check_in} al ${booking.check_out}`,
    callback_url: `${siteUrl}/api/reservations/return/${booking.id}`,
    webhook_url: `${siteUrl}/api/reservations/webhook`,
  }, await token());
  if (result.type !== "200") {
    throw new CheckoutError("tilopay_link", "rejected", { providerCode: result.type });
  }
  if (!Number.isSafeInteger(result.id) || result.id! <= 0) {
    throw new CheckoutError("tilopay_link", "invalid_response");
  }
  const url = trustedTilopayPaymentUrl(result.url);
  if (!url) throw new CheckoutError("tilopay_link", "invalid_payment_url");
  await checkoutStep("payment_link_save", () => savePaymentLink(booking.id, String(result.id)));
  return url;
}

type Payment = { orderNumber?: string; amount?: string; currency?: string; code?: string;
  capture?: string; environment?: string; type?: string; merchantId?: string | number;
  id?: number | string; id_tilopay?: number | string };

type LinkPayment = { orderNumber?: string; id?: number | string; amount?: string;
  currency?: string; code?: string; create?: string };
type PaymentCandidate = { order: string; transactionId?: string };

function paymentId(value: unknown): string | null {
  if ((typeof value !== "number" && typeof value !== "string") ||
    !/^[1-9]\d{0,15}$/.test(String(value)) || !Number.isSafeInteger(Number(value))) return null;
  return String(value);
}

function validOrder(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(value);
}

function amountMatches(value: unknown, cents: number) {
  return typeof value === "string" && /^\d+(\.\d{1,2})?$/.test(value) &&
    Math.round(Number(value) * 100) === cents;
}

async function linkPaymentCandidates(payments: LinkPayment[], booking: Booking,
  key: string, bearer: string): Promise<PaymentCandidate[]> {
  if (payments.length > 20 || payments.some((payment) => !payment || typeof payment !== "object")) {
    throw new CheckoutError("tilopay_check", "invalid_response");
  }
  const candidates: PaymentCandidate[] = [];
  // The live link-detail endpoint supplies transaction IDs, not orderNumber.
  // Resolve only those exact IDs via the authenticated transaction list, then
  // verify the individual transaction with consult. Never match by amount/email.
  const unresolved = new Map<string, Set<string>>();
  for (const payment of payments) {
    if (payment.code !== undefined && payment.code !== "1") continue;
    if (validOrder(payment.orderNumber)) {
      const id = paymentId(payment.id);
      if (payment.id !== undefined && !id) throw new CheckoutError("tilopay_check", "unsupported_payment");
      candidates.push({ order: payment.orderNumber, ...(id ? { transactionId: id } : {}) });
      continue;
    }
    const id = paymentId(payment.id);
    const timestamp = payment.create;
    const day = typeof timestamp === "string" ? timestamp.slice(0, 10) : "";
    if (!id || !amountMatches(payment.amount, booking.amount_cents) || payment.currency !== booking.currency ||
      typeof timestamp !== "string" || !/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(timestamp) || !validDate(day)) {
      throw new CheckoutError("tilopay_check", "unsupported_payment");
    }
    const ids = unresolved.get(day) ?? new Set<string>();
    ids.add(id);
    unresolved.set(day, ids);
  }
  // A single-use link should have payments from the same short checkout window.
  // Bound both queries and rows rather than scanning an entire merchant history.
  if (unresolved.size > 2) throw new CheckoutError("tilopay_check", "unsupported_payment");
  for (const [day, ids] of unresolved) {
    const result = await api<{ type?: string; response?: Payment[] }>("consultTransactions", {
      key, startDate: `${addDays(day, -1)} 00:00:00`, endDate: `${addDays(day, 1)} 23:59:59`,
      onlyAproved: 1, environment: process.env.TILOPAY_EXPECTED_ENVIRONMENT === "Test" ? 1 : 0,
      currency: [booking.currency], merchantId: process.env.TILOPAY_MERCHANT_ID ?? "",
    }, bearer);
    if (result.type !== "200" || !Array.isArray(result.response) || result.response.length > 2000) {
      throw new CheckoutError("tilopay_check", "invalid_response");
    }
    for (const id of ids) {
      const matches = result.response.filter((row) => row && paymentId(row.id) === id);
      if (matches.length > 1) throw new CheckoutError("tilopay_check", "ambiguous_payment");
      // Eventual consistency: a link can show a payment before it is listed.
      if (!matches.length) continue;
      const row = matches[0];
      // The live list omits merchantId. Enforce it using consult, which supplies
      // the actual merchant, not by inventing a value for a missing list field.
      if (!validOrder(row.orderNumber) || !matchesApprovedTerms(row, booking, row.orderNumber)) continue;
      candidates.push({ order: row.orderNumber, transactionId: id });
    }
  }
  return candidates;
}

function matchesApprovedTerms(payment: Payment, booking: Booking, order: string) {
  const expectedEnvironment = process.env.TILOPAY_EXPECTED_ENVIRONMENT;
  if (expectedEnvironment !== "Test" && expectedEnvironment !== "Production") {
    throw new Error("TILOPAY_EXPECTED_ENVIRONMENT must be Test or Production");
  }
  return payment.orderNumber === order &&
    payment.code === "1" &&
    payment.capture === "Capture" &&
    payment.environment === expectedEnvironment &&
    payment.currency === booking.currency &&
    amountMatches(payment.amount, booking.amount_cents) &&
    payment.type === "Payment";
}

export function matchesApprovedPayment(payment: Payment, booking: Booking, order: string) {
  return matchesApprovedTerms(payment, booking, order) &&
    (!process.env.TILOPAY_MERCHANT_ID || String(payment.merchantId) === process.env.TILOPAY_MERCHANT_ID);
}

export async function paymentApproved(booking: Booking) {
  if (!booking.payment_reference) return false;
  if (!["Test", "Production"].includes(process.env.TILOPAY_EXPECTED_ENVIRONMENT ?? "")) {
    throw new CheckoutError("tilopay_check", "unsupported_payment");
  }
  const { key } = credentials();
  const bearer = await token();
  let candidates: PaymentCandidate[] = [{ order: booking.payment_reference }];
  if (booking.payment_link_id) {
    const result = await api<{ type?: string; detail?: { id?: number; reference?: string;
      amount?: string; currency?: string }; payments?: LinkPayment[] }>(
      `getDetailLinkPayment/${encodeURIComponent(booking.payment_link_id)}/${encodeURIComponent(key)}`, null, bearer);
    if (result.type !== "200" || !result.detail || !Array.isArray(result.payments)) {
      throw new CheckoutError("tilopay_check", "invalid_response");
    }
    if (String(result.detail.id) !== booking.payment_link_id || result.detail.reference !== booking.payment_reference ||
      result.detail.currency !== booking.currency || !amountMatches(result.detail.amount, booking.amount_cents)) {
      throw new CheckoutError("tilopay_check", "link_mismatch");
    }
    candidates = await linkPaymentCandidates(result.payments, booking, key, bearer);
  }
  for (const { order, transactionId } of candidates) {
    const result = await api<{ type?: string; response?: Payment[] }>("consult",
      { key, orderNumber: order, merchantId: process.env.TILOPAY_MERCHANT_ID ?? "" }, bearer);
    if (result.type !== "200" || !Array.isArray(result.response)) {
      throw new CheckoutError("tilopay_check", "invalid_response");
    }
    if (result.response.some((payment) => payment && matchesApprovedPayment(payment, booking, order) &&
      (!transactionId || paymentId(payment.id_tilopay) === transactionId))) return true;
  }
  return false;
}

export async function closeExpiredPaymentLink(booking: Booking) {
  if (!booking.payment_link_id || booking.payment_link_closed_at || booking.status !== "expired") return;
  const { key } = credentials();
  const result = await api<{ type?: string }>("deleteLinkPayment", { key, id: booking.payment_link_id }, await token());
  if (result.type !== "200") throw new Error("Tilopay could not close the expired payment link");
  await getPool().query("UPDATE reservations SET payment_link_closed_at = now() WHERE id = $1", [booking.id]);
}
