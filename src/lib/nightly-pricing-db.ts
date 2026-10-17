import "server-only";
import type { Pool, PoolClient } from "pg";
import { getDome } from "@/data/domes";
import { BookingError } from "@/lib/booking-error";
import { makeNightlyPricing, validatePriceRange } from "@/lib/nightly-pricing";

export function baseNightPrice(dome: string) {
  if (!getDome(dome)) throw new BookingError("Domo desconocido.", 400);
  const key = dome === "domo-romantico" ? "PRICE_DOMO_ROMANTICO_CENTS" : "PRICE_DOMO_AMPLIO_CENTS";
  const price = Number(process.env[key]);
  if (!Number.isSafeInteger(price) || price < 1 || price > 100000000) throw new BookingError("Tarifa base no configurada.", 503);
  return price;
}

export function priceCurrency() {
  const currency = process.env.BOOKING_CURRENCY ?? "";
  if (!/^[A-Z]{3}$/.test(currency)) throw new BookingError("Moneda no configurada.", 503);
  return currency;
}

export async function readNightlyPricing(db: Pool | PoolClient, dome: string, start: string, end: string) {
  validatePriceRange(start, end);
  const base = baseNightPrice(dome);
  const currency = priceCurrency();
  const result = await db.query<{ date: string; amount_cents: number; currency: string }>(
    `SELECT night::text AS date, amount_cents, currency FROM nightly_prices
     WHERE dome = $1 AND night >= $2::date AND night < $3::date ORDER BY night`, [dome, start, end]);
  // Never reinterpret an owner-set amount in a different currency.
  if (result.rows.some((row) => row.currency !== currency)) throw new BookingError("Revisa la moneda de las tarifas especiales.", 503);
  return makeNightlyPricing(dome, start, end, currency, base,
    result.rows.map((row) => ({ date: row.date, amountCents: row.amount_cents })));
}

export async function lockPriceCalendar(client: PoolClient, dome: string) {
  const result = await client.query("SELECT dome FROM rate_calendars WHERE dome = $1 FOR UPDATE", [dome]);
  if (!result.rows.length) throw new BookingError("Falta aplicar la migración de precios.", 503);
}
