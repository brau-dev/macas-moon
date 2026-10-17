import { BookingError } from "@/lib/booking-error";
import { validDate } from "@/lib/booking-validation";
import { addDays, nightsBetween } from "@/lib/date-range";

export type NightPrice = { date: string; amountCents: number; special: boolean };
export type NightlyPricing = { dome: string; start: string; end: string; currency: string;
  basePriceCents: number; nights: NightPrice[]; amountCents: number };

export function validatePriceRange(start: string, end: string, max = 62) {
  if (!validDate(start) || !validDate(end) || nightsBetween(start, end) < 1 || nightsBetween(start, end) > max) {
    throw new BookingError("Selecciona un rango válido de noches.", 400);
  }
}

// Parse decimals without binary floating-point rounding or silently truncating cents.
export function parseNightPrice(value: unknown) {
  if (typeof value !== "string" || !/^\d{1,7}([.,]\d{1,2})?$/.test(value.trim())) {
    throw new BookingError("Introduce un precio positivo con un máximo de dos decimales.", 400);
  }
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000) {
    throw new BookingError("El precio debe estar entre 0,01 y 1.000.000 por noche.", 400);
  }
  return cents;
}

export function makeNightlyPricing(dome: string, start: string, end: string, currency: string,
  basePriceCents: number, overrides: Array<{ date: string; amountCents: number }>): NightlyPricing {
  validatePriceRange(start, end);
  const prices = new Map(overrides.map((row) => [row.date, row.amountCents]));
  const nights: NightPrice[] = [];
  let amountCents = 0;
  for (let date = start; date < end; date = addDays(date, 1)) {
    const value = prices.get(date) ?? basePriceCents;
    if (!Number.isSafeInteger(value) || value <= 0) throw new BookingError("Precio no disponible.", 503);
    nights.push({ date, amountCents: value, special: prices.has(date) });
    amountCents += value;
  }
  if (!Number.isSafeInteger(amountCents)) throw new BookingError("Importe fuera del límite permitido.", 400);
  return { dome, start, end, currency, basePriceCents, nights, amountCents };
}
