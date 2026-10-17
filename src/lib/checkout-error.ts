import { BookingError } from "@/lib/booking-error";

export type CheckoutStage = "security" | "availability" | "reservation_create" |
  "reservation_read" | "reservation_cleanup" | "tilopay_auth" | "tilopay_link" |
  "tilopay_check" | "tilopay_close" | "payment_link_save" | "payment_link_resolution";
type CheckoutReason = "unexpected" | "network" | "timeout" | "http" |
  "invalid_response" | "rejected" | "missing_token" | "invalid_payment_url" |
  "link_mismatch" | "unsupported_payment" | "ambiguous_payment" | "environment_mismatch";

// Only application-controlled labels are exposed. Never include provider messages,
// URLs, request bodies, SQL details, credentials or guest information.
export class CheckoutError extends Error {
  constructor(
    public readonly stage: CheckoutStage,
    public readonly reason: CheckoutReason,
    options: { cause?: unknown; upstreamStatus?: number; providerCode?: unknown; providerStatus?: unknown } = {},
  ) {
    super("Checkout operation failed", { cause: options.cause });
    this.name = "CheckoutError";
    this.upstreamStatus = options.upstreamStatus;
    const code = options.providerCode;
    this.providerCode = (typeof code === "string" || typeof code === "number") &&
      /^\d{1,3}$/.test(String(code)) ? String(code) : undefined;
    const status = options.providerStatus;
    this.providerStatus = (typeof status === "string" || typeof status === "number") &&
      /^\d{1,3}$/.test(String(status)) ? String(status) : undefined;
  }
  readonly upstreamStatus?: number;
  readonly providerCode?: string;
  readonly providerStatus?: string;
}

export type PaymentLinkDiagnostic = {
  stage: CheckoutStage; reason: CheckoutReason; upstreamStatus?: number; providerCode?: string; providerStatus?: string; reference: string;
};

export function paymentLinkDiagnostic(error: unknown, reference: string): PaymentLinkDiagnostic {
  const failure = error instanceof CheckoutError ? error : new CheckoutError("payment_link_resolution", "unexpected");
  return { stage: failure.stage, reason: failure.reason, reference,
    ...(failure.upstreamStatus ? { upstreamStatus: failure.upstreamStatus } : {}),
    ...(failure.providerCode ? { providerCode: failure.providerCode } : {}),
    ...(failure.providerStatus ? { providerStatus: failure.providerStatus } : {}) };
}

export async function checkoutStep<T>(stage: CheckoutStage, run: () => Promise<T>): Promise<T> {
  try { return await run(); }
  catch (error) {
    if (error instanceof BookingError || error instanceof CheckoutError) throw error;
    const name = error instanceof Error ? error.name : "";
    const reason = name === "TimeoutError" || name === "AbortError" ? "timeout"
      : name === "TypeError" ? "network" : "unexpected";
    throw new CheckoutError(stage, reason, { cause: error });
  }
}

export function checkoutPublicMessage(error: unknown) {
  if (!(error instanceof CheckoutError)) return "No se pudo iniciar la reserva. Intenta de nuevo.";
  if (error.stage === "security") return "No se pudo completar la verificación de seguridad. Intenta de nuevo.";
  if (["tilopay_auth", "tilopay_link"].includes(error.stage)) {
    return "No se pudo abrir la página de pago de Tilopay. La reserva no está confirmada.";
  }
  return "No se pudo preparar la reserva para el pago. Intenta de nuevo.";
}
