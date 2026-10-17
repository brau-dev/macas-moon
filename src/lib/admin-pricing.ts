import "server-only";
import { getDome } from "@/data/domes";
import { getPool, transaction } from "@/lib/booking-db";
import { BookingError } from "@/lib/booking-error";
import { validatePriceRange, parseNightPrice } from "@/lib/nightly-pricing";
import { baseNightPrice, lockPriceCalendar, priceCurrency, readNightlyPricing } from "@/lib/nightly-pricing-db";
import { todayInCostaRica } from "@/lib/date-range";

export async function adminPrices(dome: string, start: string, end: string) {
  // A disabled/unconfigured dome must remain inspectable by its administrator.
  // Missing rates disable editing, never substitute a guessed price.
  try { baseNightPrice(dome); priceCurrency(); }
  catch (error) { if (error instanceof BookingError && error.status === 503) return null; throw error; }
  return readNightlyPricing(getPool(), dome, start, end);
}

export async function changeNightPrices(body: Record<string, unknown>, actor: string, restore = false) {
  const { dome, start, end } = body;
  if (typeof dome !== "string" || !getDome(dome) || typeof start !== "string" || typeof end !== "string") {
    throw new BookingError("Domo o fechas inválidos.", 400);
  }
  validatePriceRange(start, end, 365);
  if (start < todayInCostaRica()) throw new BookingError("No se pueden cambiar precios de noches pasadas.", 400);
  baseNightPrice(dome);
  const currency = priceCurrency();
  const cents = restore ? null : parseNightPrice(body.price);
  await transaction(async (client) => {
    await lockPriceCalendar(client, dome);
    if (restore) {
      await client.query("DELETE FROM nightly_prices WHERE dome = $1 AND night >= $2::date AND night < $3::date", [dome, start, end]);
    } else {
      await client.query(`INSERT INTO nightly_prices (dome, night, amount_cents, currency, updated_by)
        SELECT $1, day::date, $4, $5, $6 FROM generate_series($2::date, $3::date - 1, interval '1 day') day
        ON CONFLICT (dome, night) DO UPDATE SET amount_cents = EXCLUDED.amount_cents,
          currency = EXCLUDED.currency, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [dome, start, end, cents, currency, actor]);
    }
  });
}
