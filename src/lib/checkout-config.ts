import "server-only";
import { BookingError } from "@/lib/booking-error";

export function missingCheckoutConfig() {
  const keys = ["TILOPAY_API_USER", "TILOPAY_API_PASSWORD", "TILOPAY_API_KEY",
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"];
  const missing = keys.filter((key) => !process.env[key]?.trim());
  if (!["Test", "Production"].includes(process.env.TILOPAY_EXPECTED_ENVIRONMENT ?? "")) missing.push("TILOPAY_EXPECTED_ENVIRONMENT");
  return missing;
}

export function requireCheckoutConfig() {
  if (missingCheckoutConfig().length) {
    throw new BookingError("Los pagos todavía no están configurados completamente. Contacta al alojamiento.", 503);
  }
}
