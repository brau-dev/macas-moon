import { CheckoutError } from "@/lib/checkout-error";

// Never log provider bodies, credentials, URLs, SQL details, guest data or stacks.
export function logServerError(event: string, error: unknown, requestId?: string) {
  const details: { code?: string; status?: number; stage?: string; reason?: string;
    upstreamStatus?: number; providerCode?: string; providerStatus?: string; requestId?: string } = {};
  if (requestId && /^[a-f0-9-]{36}$/.test(requestId)) details.requestId = requestId;
  if (error instanceof CheckoutError) {
    details.stage = error.stage;
    details.reason = error.reason;
    if (error.upstreamStatus && Number.isInteger(error.upstreamStatus) &&
      error.upstreamStatus >= 400 && error.upstreamStatus <= 599) details.upstreamStatus = error.upstreamStatus;
    if (error.providerCode) details.providerCode = error.providerCode;
    if (error.providerStatus) details.providerStatus = error.providerStatus;
  }
  // Network drivers often put the useful code inside Error.cause.
  let current = error;
  for (let depth = 0; depth < 3 && current && typeof current === "object"; depth++) {
    const value = current as { code?: unknown; status?: unknown; cause?: unknown };
    if (typeof value.code === "string" && (/^[0-9A-Z]{5}$/.test(value.code) ||
      ["EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND"].includes(value.code))) details.code = value.code;
    if (typeof value.status === "number" && Number.isInteger(value.status) && value.status >= 400 && value.status <= 599) details.status = value.status;
    current = value.cause;
  }
  console.error(event, details);
}
