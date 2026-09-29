import type { Booking } from "@/lib/booking-db";

const API = "https://app.tilopay.com/api/v1";

async function api<T>(path: string, body: object, bearer?: string): Promise<T> {
  const response = await fetch(`${API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Tilopay ${path} HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function credentials() {
  const { TILOPAY_API_USER, TILOPAY_API_PASSWORD, TILOPAY_API_KEY } = process.env;
  if (!TILOPAY_API_USER || !TILOPAY_API_PASSWORD || !TILOPAY_API_KEY) {
    throw new Error("Tilopay credentials are not configured");
  }
  return { user: TILOPAY_API_USER, password: TILOPAY_API_PASSWORD, key: TILOPAY_API_KEY };
}

async function token() {
  const { user, password } = credentials();
  const result = await api<{ access_token?: string }>("login", { apiuser: user, password });
  if (!result.access_token) throw new Error("Tilopay did not return a token");
  return result.access_token;
}

export async function createPaymentUrl(booking: Booking, siteUrl: string) {
  const { key } = credentials();
  const names = booking.guest_name.trim().split(/\s+/);
  const firstName = names.shift() ?? booking.guest_name;
  const lastName = names.join(" ") || firstName;
  const address = {
    FirstName: firstName,
    LastName: lastName,
    Address: booking.billing_address,
    Address2: "",
    City: booking.billing_city,
    State: booking.billing_state,
    ZipPostCode: booking.billing_postal_code,
    Country: booking.billing_country,
    Telephone: booking.guest_phone,
  };
  const fields = Object.fromEntries(Object.entries(address).flatMap(([name, value]) => [
    [`billTo${name}`, value], [`shipTo${name}`, value],
  ]));
  const result = await api<{ type?: string; url?: string }>("processPayment", {
    redirect: `${siteUrl}/api/reservations/return/${booking.id}`,
    key,
    amount: (booking.amount_cents / 100).toFixed(2),
    currency: booking.currency,
    orderNumber: booking.payment_reference,
    capture: "1",
    ...fields,
    billToEmail: booking.guest_email,
    subscription: "0",
    platform: "macas-moon",
    returnData: Buffer.from(booking.id).toString("base64"),
    token_version: "v2",
  }, await token());
  if (result.type !== "100" || !result.url) throw new Error("Tilopay did not create a payment URL");
  const url = new URL(result.url);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".tilopay.com")) {
    throw new Error("Tilopay returned an unexpected payment URL");
  }
  return url.toString();
}

export async function paymentApproved(booking: Booking) {
  if (!booking.payment_reference) return false;
  const { key } = credentials();
  const result = await api<{
    type?: string;
    response?: Array<{ orderNumber?: string; amount?: string; currency?: string; code?: string; capture?: string; environment?: string }>;
  }>("consult", { key, orderNumber: booking.payment_reference, merchantId: process.env.TILOPAY_MERCHANT_ID ?? "" }, await token());
  if (result.type !== "200" || !Array.isArray(result.response)) return false;
  const expectedEnvironment = process.env.TILOPAY_EXPECTED_ENVIRONMENT;
  if (expectedEnvironment !== "Test" && expectedEnvironment !== "Production") {
    throw new Error("TILOPAY_EXPECTED_ENVIRONMENT must be Test or Production");
  }
  return result.response.some((payment) =>
    payment.orderNumber === booking.payment_reference &&
    payment.code === "1" &&
    payment.capture === "Capture" &&
    payment.environment === expectedEnvironment &&
    payment.currency === booking.currency &&
    Math.round(Number(payment.amount) * 100) === booking.amount_cents,
  );
}
