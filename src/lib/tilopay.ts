import "server-only";
import { createHash } from "node:crypto";
import { getPool, savePaymentLink, type Booking } from "@/lib/booking-db";

const API = "https://app.tilopay.com/api/v1";

async function api<T>(path: string, body: object | null, bearer?: string): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    method: body === null ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: body === null ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  // GET detail paths contain the merchant key: never put them in logs/errors.
  if (!response.ok) throw new Error(`Tilopay ${path.split("/")[0]} HTTP ${response.status}`);
  return response.json() as Promise<T>;
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
    if (!result.access_token) throw new Error("Tilopay did not return a token");
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
  if (result.type !== "200" || !result.url || !Number.isSafeInteger(result.id) || result.id! <= 0) {
    throw new Error("Tilopay did not create a single-use payment link");
  }
  const url = new URL(result.url);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".tilopay.com")) {
    throw new Error("Tilopay returned an unexpected payment URL");
  }
  await savePaymentLink(booking.id, String(result.id));
  return url.toString();
}

type Payment = { orderNumber?: string; amount?: string; currency?: string; code?: string;
  capture?: string; environment?: string; type?: string; merchantId?: string | number };

export function matchesApprovedPayment(payment: Payment, booking: Booking, order: string) {
  const expectedEnvironment = process.env.TILOPAY_EXPECTED_ENVIRONMENT;
  if (expectedEnvironment !== "Test" && expectedEnvironment !== "Production") {
    throw new Error("TILOPAY_EXPECTED_ENVIRONMENT must be Test or Production");
  }
  return payment.orderNumber === order &&
    (!process.env.TILOPAY_MERCHANT_ID || String(payment.merchantId) === process.env.TILOPAY_MERCHANT_ID) &&
    payment.code === "1" &&
    payment.capture === "Capture" &&
    payment.environment === expectedEnvironment &&
    payment.currency === booking.currency &&
    /^\d+(\.\d{1,2})?$/.test(payment.amount ?? "") &&
    Math.round(Number(payment.amount) * 100) === booking.amount_cents &&
    payment.type === "Payment";
}

export async function paymentApproved(booking: Booking) {
  if (!booking.payment_reference) return false;
  const { key } = credentials();
  const bearer = await token();
  let orders = [booking.payment_reference];
  if (booking.payment_link_id) {
    const result = await api<{ type?: string; detail?: { id?: number; reference?: string;
      amount?: string; currency?: string }; payments?: Array<{ orderNumber?: string }> }>(
      `getDetailLinkPayment/${encodeURIComponent(booking.payment_link_id)}/${encodeURIComponent(key)}`, null, bearer);
    if (result.type !== "200" || !result.detail || !Array.isArray(result.payments)) {
      throw new Error("Tilopay payment link detail could not be verified");
    }
    if (String(result.detail.id) !== booking.payment_link_id || result.detail.reference !== booking.payment_reference ||
      result.detail.currency !== booking.currency || !/^\d+(\.\d{1,2})?$/.test(result.detail.amount ?? "") ||
      Math.round(Number(result.detail.amount) * 100) !== booking.amount_cents) {
      throw new Error("Tilopay payment link does not match the reservation");
    }
    // Only take order numbers from the authenticated detail endpoint, not from a callback/webhook.
    orders = [...new Set(result.payments.map((payment) => payment.orderNumber)
      .filter((order): order is string => typeof order === "string" && /^[A-Za-z0-9_-]{1,150}$/.test(order)))];
    if (result.payments.length && !orders.length) {
      throw new Error("Tilopay returned an undocumented payment detail; verify the merchant contract before going live");
    }
  }
  for (const order of orders.slice(0, 10)) {
    const result = await api<{ type?: string; response?: Payment[] }>("consult",
      { key, orderNumber: order, merchantId: process.env.TILOPAY_MERCHANT_ID ?? "" }, bearer);
    if (result.type === "200" && result.response?.some((payment) => matchesApprovedPayment(payment, booking, order))) return true;
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
