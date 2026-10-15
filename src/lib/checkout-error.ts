import { BookingError } from "@/lib/booking-error";

export type CheckoutStage = "security" | "availability" | "reservation_create" |
  "reservation_read" | "reservation_cleanup" | "tilopay_auth" | "tilopay_link" |
  "tilopay_check" | "payment_link_save";
type CheckoutReason = "unexpected" | "network" | "timeout" | "http" |
  "invalid_response" | "rejected" | "missing_token" | "invalid_payment_url" |
  "link_mismatch" | "unsupported_payment" | "ambiguous_payment";

// Only application-controlled labels are exposed. Never include provider messages,
// URLs, request bodies, SQL details, credentials or guest information.
export class CheckoutError extends Error {
  constructor(
    public readonly stage: CheckoutStage,
    public readonly reason: CheckoutReason,
    options: { cause?: unknown; upstreamStatus?: number; providerCode?: unknown } = {},
  ) {
    super("Checkout operation failed", { cause: options.cause });
    this.name = "CheckoutError";
    this.upstreamStatus = options.upstreamStatus;
    const code = options.providerCode;
    this.providerCode = (typeof code === "string" || typeof code === "number") &&
      /^\d{1,3}$/.test(String(code)) ? String(code) : undefined;
  }
  readonly upstreamStatus?: number;
  readonly providerCode?: string;
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
