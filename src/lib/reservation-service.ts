import "server-only";
import { randomUUID } from "node:crypto";
import { BookingError } from "@/lib/booking-error";
import { verifyBookingChallenge } from "@/lib/turnstile";
import { testSecretAuthorized } from "@/lib/test-mode";
import { getSiteOrigin } from "@/lib/site-origin";
export { BookingError } from "@/lib/booking-error";
import { getDome } from "@/data/domes";
import { isDomeActive } from "@/lib/active-domes";
import { getCombinedAvailability } from "@/lib/combined-availability";
import { overlapsBlocked } from "@/lib/availability-types";
import { createBooking, getBooking, confirmBooking, expireBooking, recordPaymentCheck, type NewBooking } from "@/lib/booking-db";
import { createPaymentUrl, paymentApproved, requirePaymentEnvironment } from "@/lib/tilopay";
import { sendConfirmation } from "@/lib/booking-email";
import { cleanField as clean, validateStay } from "@/lib/booking-validation";
import { isResidenceCountry } from "@/lib/countries";
import { requireCheckoutConfig } from "@/lib/checkout-config";
import { logServerError } from "@/lib/safe-log";
import { CheckoutError, checkoutStep } from "@/lib/checkout-error";

type BookingInput = {
  dome: string; checkIn: string; checkOut: string; guests: number;
  name: string; email: string; phone: string;
  country: string;
};

function validate(input: unknown): BookingInput {
  if (!input || typeof input !== "object") throw new BookingError("Datos de reserva inválidos.", 400);
  const value = input as Record<string, unknown>;
  const dome = clean(value.dome, 40);
  const selected = getDome(dome);
  if (!selected) throw new BookingError("Domo desconocido.", 400);
  const checkIn = clean(value.checkIn, 10);
  const checkOut = clean(value.checkOut, 10);
  validateStay(checkIn, checkOut);
  const guests = Number(value.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > selected.capacity) {
    throw new BookingError("Número de huéspedes inválido.", 400);
  }
  const email = clean(value.email, 254);
  if (!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email)) throw new BookingError("Correo inválido.", 400);
  const country = clean(value.country, 2).toUpperCase();
  if (!isResidenceCountry(country)) throw new BookingError("País de residencia inválido.", 400);
  return {
    dome, checkIn, checkOut, guests,
    name: clean(value.name, 100), email, phone: clean(value.phone, 25),
    country,
  };
}

export async function startReservation(raw: unknown, testSecret: string | null, requestOrigin: string) {
  const test = testSecret !== null;
  if (process.env.BOOKING_ENABLED !== "true") throw new BookingError("Reservas en línea aún no habilitadas.", 503);
  if (test) {
    if (!testSecretAuthorized(requestOrigin, testSecret)) {
      throw new BookingError("Acceso no autorizado para reservas sin cobro.", 403);
    }
  } else if (process.env.TILOPAY_CHECKOUT_ENABLED !== "true") {
    throw new BookingError("Pagos en línea aún no habilitados.", 503);
  }
  if (!test) requireCheckoutConfig();
  const input = validate(raw);
  if (!isDomeActive(input.dome)) throw new BookingError("Este domo no admite reservas en línea actualmente.", 503);
  if (!test) await checkoutStep("security", () => verifyBookingChallenge((raw as Record<string, unknown>).turnstileToken));
  const availability = await checkoutStep("availability", () => getCombinedAvailability(input.dome, true));
  if (availability.status !== "ready") throw new BookingError("No se pudo verificar toda la disponibilidad. Intenta más tarde.", 503);
  if (overlapsBlocked(input.checkIn, input.checkOut, availability.blocked)) {
    throw new BookingError("Estas fechas ya están ocupadas.", 409);
  }
  const currency = process.env.BOOKING_CURRENCY;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new BookingError("Moneda no configurada.", 503);
  const id = randomUUID();
  const amount = (raw as Record<string, unknown>).expectedAmountCents;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new BookingError("Revisa el precio de la estadía antes de continuar.", 400);
  }
  const siteUrl = getSiteOrigin();
  if (!test && !siteUrl) {
    throw new BookingError("URL de pagos no configurada.", 503);
  }
  const booking: NewBooking = {
    id, dome: input.dome, check_in: input.checkIn, check_out: input.checkOut,
    guests: input.guests, guest_name: input.name, guest_email: input.email,
    guest_phone: input.phone, billing_country: input.country,
    amount_cents: amount, currency, payment_provider: test ? "test" : "tilopay",
    payment_environment: test ? "Test" : process.env.TILOPAY_EXPECTED_ENVIRONMENT as "Test" | "Production",
    payment_reference: test ? null : `MM${id.replaceAll("-", "").toUpperCase()}`,
  };
  try { await createBooking(booking); }
  catch (error) {
    if (error instanceof BookingError) throw error;
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new BookingError("Estas fechas acaban de reservarse. Elige otras.", 409);
    }
    throw new CheckoutError("reservation_create", "unexpected", { cause: error });
  }
  if (test) {
    const confirmed = await confirmBooking(id);
    if (!confirmed) throw new BookingError("No se pudo confirmar la reserva sin cobro.", 500);
    try { await sendConfirmation(confirmed); } catch (error) { logServerError("Confirmation email failed", error); }
    return { id, status: "confirmed" as const, amountCents: 0, currency };
  }
  try {
    const saved = await checkoutStep("reservation_read", () => getBooking(id));
    if (!saved) throw new CheckoutError("reservation_read", "unexpected");
    const paymentUrl = await createPaymentUrl(saved, siteUrl!);
    return { id, status: "pending" as const, paymentUrl, amountCents: amount, currency };
  } catch (error) {
    // Cleanup must not replace the original payment failure with a second error.
    // Unreleased holds still expire after 15 minutes; the scheduled job retries cleanup.
    try { await checkoutStep("reservation_cleanup", () => expireBooking(id)); }
    catch (cleanupError) { logServerError("Reservation cleanup failed", cleanupError); }
    throw error;
  }
}

export async function reconcilePayment(id: string) {
  const booking = await getBooking(id);
  if (!booking) throw new BookingError("Reserva desconocida.", 404);
  if (booking.status === "confirmed") return booking;
  if (booking.payment_provider !== "tilopay") return booking;
  // An administrator deliberately cancelled an already confirmed payment.
  // Never reactivate it or misreport that known charge as a new late payment.
  if (booking.status === "cancelled" && booking.cancelled_from_status === "confirmed") return booking;
  requirePaymentEnvironment(booking);
  // Timestamp failed checks too, so one failing row cannot starve reconciliation.
  await recordPaymentCheck(id);
  const approved = await paymentApproved(booking);
  if (!approved) {
    if (booking.status === "pending" && booking.expires_at && booking.expires_at.valueOf() <= Date.now()) {
      await expireBooking(id);
      return (await getBooking(id))!;
    }
    return booking;
  }
  if (booking.status !== "pending") {
    const cancelled = booking.status === "cancelled";
    await recordPaymentCheck(id, cancelled
      ? "Pago aprobado de una reserva anulada. Revisar el pago y gestionar el reembolso si corresponde; no confirmar automáticamente."
      : "Pago aprobado sin bloqueo vigente. Revisar disponibilidad y gestionar reembolso; no confirmar automáticamente.");
    throw new BookingError(cancelled ? "Pago aprobado de una reserva anulada; requiere gestión inmediata."
      : "Pago aprobado tras vencer el bloqueo; requiere reembolso o gestión inmediata.", 409);
  }
  const confirmed = await confirmBooking(id);
  if (!confirmed) {
    const current = await getBooking(id);
    if (current?.status === "confirmed") return current;
    if (current?.status === "cancelled") {
      if (current.cancelled_from_status === "confirmed") return current;
      await recordPaymentCheck(id, "Pago aprobado durante la anulación de la reserva. Revisar el pago y gestionar el reembolso si corresponde; no confirmar automáticamente.");
      throw new BookingError("Pago aprobado de una reserva anulada; requiere gestión inmediata.", 409);
    }
    await expireBooking(id);
    await recordPaymentCheck(id, "Pago aprobado después del vencimiento. Requiere gestión inmediata y posible reembolso.");
    throw new BookingError("Pago aprobado tras vencer el bloqueo; requiere reembolso o gestión inmediata.", 409);
  }
  try { await sendConfirmation(confirmed); } catch (error) { logServerError("Confirmation email failed", error); }
  // Email markers change after confirmation. Return fresh state so the first
  // payment-status response does not report a successfully sent email as pending.
  return (await getBooking(id)) ?? confirmed;
}
