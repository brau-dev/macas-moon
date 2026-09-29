import { BookingError } from "@/lib/booking-error";

export async function verifyBookingChallenge(token: unknown) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const siteUrl = process.env.BOOKING_SITE_URL;
  if (!secret || !siteUrl) throw new BookingError("Protección del checkout no configurada.", 503);
  if (typeof token !== "string" || !token || token.length > 2048) {
    throw new BookingError("Completa la verificación de seguridad.", 400);
  }
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret, response: token }),
    cache: "no-store", signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new BookingError("No se pudo verificar la seguridad del pago.", 503);
  const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
  if (!result.success || result.action !== "booking" || result.hostname !== new URL(siteUrl).hostname) {
    throw new BookingError("Verificación de seguridad inválida. Intenta de nuevo.", 400);
  }
}
