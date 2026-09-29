import { randomUUID } from "node:crypto";
import { BookingError } from "@/lib/booking-error";
import { verifyBookingChallenge } from "@/lib/turnstile";
import { testSecretAuthorized } from "@/lib/test-mode";
export { BookingError } from "@/lib/booking-error";
import { getDome } from "@/data/domes";
import { getCombinedAvailability } from "@/lib/combined-availability";
import { overlapsBlocked } from "@/lib/availability-types";
import { createBooking, getBooking, confirmBooking, expireBooking, type Booking } from "@/lib/booking-db";
import { nightsBetween, todayInCostaRica } from "@/lib/date-range";
import { createPaymentUrl, paymentApproved } from "@/lib/tilopay";
import { sendConfirmation } from "@/lib/booking-email";

type BookingInput = {
  dome: string; checkIn: string; checkOut: string; guests: number;
  name: string; email: string; phone: string;
  address: string; city: string; state: string; postalCode: string; country: string;
};

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") throw new BookingError("Datos de reserva incompletos.", 400);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new BookingError("Datos de reserva inválidos.", 400);
  return trimmed;
}

function validate(input: unknown): BookingInput {
  if (!input || typeof input !== "object") throw new BookingError("Datos de reserva inválidos.", 400);
  const value = input as Record<string, unknown>;
  const dome = clean(value.dome, 40);
  const selected = getDome(dome);
  if (!selected) throw new BookingError("Domo desconocido.", 400);
  const checkIn = clean(value.checkIn, 10);
  const checkOut = clean(value.checkOut, 10);
  if (!validDate(checkIn) || !validDate(checkOut) || checkIn <= todayInCostaRica() ||
    nightsBetween(checkIn, checkOut) < 1 || nightsBetween(checkIn, checkOut) > 30) {
    throw new BookingError("Fechas inválidas.", 400);
  }
  const guests = Number(value.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > selected.capacity) {
    throw new BookingError("Número de huéspedes inválido.", 400);
  }
  const email = clean(value.email, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BookingError("Correo inválido.", 400);
  const country = clean(value.country, 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) throw new BookingError("País inválido.", 400);
  return {
    dome, checkIn, checkOut, guests,
    name: clean(value.name, 100), email, phone: clean(value.phone, 25),
    address: clean(value.address, 150), city: clean(value.city, 80),
    state: clean(value.state, 50), postalCode: clean(value.postalCode, 20), country,
  };
}

function pricePerNight(dome: string) {
  const key = dome === "domo-romantico" ? "PRICE_DOMO_ROMANTICO_CENTS" : "PRICE_DOMO_AMPLIO_CENTS";
  const value = Number(process.env[key]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new BookingError("Tarifas aún no configuradas.", 503);
  return value;
}

export async function startReservation(raw: unknown, testSecret: string | null, requestOrigin: string) {
  const test = testSecret !== null;
  if (process.env.BOOKING_ENABLED !== "true") throw new BookingError("Reservas en línea aún no habilitadas.", 503);
  if (test) {
    if (!testSecretAuthorized(requestOrigin, testSecret)) {
      throw new BookingError("Modo de prueba no autorizado.", 403);
    }
  } else if (process.env.TILOPAY_CHECKOUT_ENABLED !== "true") {
    throw new BookingError("Pagos en línea aún no habilitados.", 503);
  }
  const input = validate(raw);
  if (!test) await verifyBookingChallenge((raw as Record<string, unknown>).turnstileToken);
  const availability = await getCombinedAvailability(input.dome, true);
  if (availability.status !== "ready") throw new BookingError("No se pudo verificar toda la disponibilidad. Intenta más tarde.", 503);
  if (overlapsBlocked(input.checkIn, input.checkOut, availability.blocked)) {
    throw new BookingError("Estas fechas ya están ocupadas.", 409);
  }
  const currency = process.env.BOOKING_CURRENCY;
  if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new BookingError("Moneda no configurada.", 503);
  const id = randomUUID();
  const amount = pricePerNight(input.dome) * nightsBetween(input.checkIn, input.checkOut);
  if (!Number.isSafeInteger(amount) || Number((raw as Record<string, unknown>).expectedAmountCents) !== amount) {
    throw new BookingError("El precio cambió. Actualiza la página antes de continuar.", 409);
  }
  const siteUrl = process.env.BOOKING_SITE_URL;
  if (!test && (!siteUrl || !/^https:\/\//.test(siteUrl))) {
    throw new BookingError("URL de pagos no configurada.", 503);
  }
  const booking: Omit<Booking, "status" | "expires_at" | "confirmation_email_sent_at"> = {
    id, dome: input.dome, check_in: input.checkIn, check_out: input.checkOut,
    guests: input.guests, guest_name: input.name, guest_email: input.email,
    guest_phone: input.phone, billing_address: input.address, billing_city: input.city,
    billing_state: input.state, billing_postal_code: input.postalCode, billing_country: input.country,
    amount_cents: amount, currency, payment_provider: test ? "test" : "tilopay",
    payment_reference: test ? null : `MM${id.replaceAll("-", "").toUpperCase()}`,
  };
  try { await createBooking(booking); }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new BookingError("Estas fechas acaban de reservarse. Elige otras.", 409);
    }
    throw error;
  }
  if (test) {
    const confirmed = await confirmBooking(id);
    if (!confirmed) throw new BookingError("No se pudo confirmar la prueba.", 500);
    try { await sendConfirmation(confirmed); } catch (error) { console.error(error); }
    return { id, status: "confirmed" as const, amountCents: 0, currency };
  }
  const saved = await getBooking(id);
  if (!saved) throw new Error("Booking disappeared after creation");
  try {
    const paymentUrl = await createPaymentUrl(saved, siteUrl!.replace(/\/$/, ""));
    return { id, status: "pending" as const, paymentUrl, amountCents: amount, currency };
  } catch (error) {
    await expireBooking(id);
    throw error;
  }
}

export async function reconcilePayment(id: string) {
  const booking = await getBooking(id);
  if (!booking) throw new BookingError("Reserva desconocida.", 404);
  if (booking.status === "confirmed") return booking;
  if (booking.payment_provider !== "tilopay") return booking;
  if (!await paymentApproved(booking)) return booking;
  if (booking.status !== "pending") {
    throw new BookingError("Pago aprobado tras vencer el bloqueo; requiere reembolso o gestión inmediata.", 409);
  }
  const confirmed = await confirmBooking(id);
  if (!confirmed) {
    const current = await getBooking(id);
    if (current?.status === "confirmed") return current;
    throw new BookingError("Pago aprobado tras vencer el bloqueo; requiere reembolso o gestión inmediata.", 409);
  }
  try { await sendConfirmation(confirmed); } catch (error) { console.error(error); }
  return confirmed;
}
