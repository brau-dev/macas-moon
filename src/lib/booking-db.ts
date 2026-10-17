import "server-only";
import { Pool, type PoolClient } from "pg";
import type { OccupiedRange } from "@/lib/availability-types";
import { logServerError } from "@/lib/safe-log";
import type { PaymentLinkDiagnostic } from "@/lib/checkout-error";
import { lockPriceCalendar, readNightlyPricing } from "@/lib/nightly-pricing-db";
import { BookingError } from "@/lib/booking-error";

let pool: Pool | undefined;

export function getPool() {
  const connectionString = process.env.NETLIFY_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Neither NETLIFY_DB_URL nor DATABASE_URL is configured");
  if (!pool) {
    pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000, allowExitOnIdle: true });
    // A network failure on an idle connection must not become an unhandled
    // EventEmitter error and terminate the serverless process.
    pool.on("error", (error) => logServerError("Idle database connection failed", error));
  }
  return pool;
}

export type Booking = {
  id: string;
  dome: string;
  check_in: string;
  check_out: string;
  guests: number;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  billing_address: string;
  billing_city: string;
  billing_state: string;
  billing_postal_code: string;
  billing_country: string;
  status: "pending" | "confirmed" | "expired" | "cancelled";
  amount_cents: number;
  currency: string;
  payment_provider: "tilopay" | "test" | "manual";
  payment_environment: "Test" | "Production";
  payment_reference: string | null;
  kind: "booking" | "manual";
  admin_note: string;
  payment_link_id: string | null;
  payment_link_closed_at: Date | null;
  payment_link_consumed_at: Date | null;
  payment_link_checked_at: Date | null;
  payment_link_error: PaymentLinkDiagnostic | null;
  payment_issue: string | null;
  payment_checked_at: Date | null;
  expires_at: Date | null;
  confirmation_email_sent_at: Date | null;
  owner_notification_sent_at: Date | null;
  owner_notification_required: boolean;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  cancelled_from_status: "pending" | "confirmed" | "expired" | null;
  cancellation_check_in: string | null;
  cancellation_check_out: string | null;
  parent_block_id: string | null;
};

export const bookingColumns = `id, dome, check_in::text, check_out::text, guests, guest_name, guest_email,
  guest_phone, billing_address, billing_city, billing_state, billing_postal_code,
  billing_country, status, amount_cents, currency, payment_provider, payment_environment,
  payment_reference, expires_at, confirmation_email_sent_at, kind, admin_note,
  payment_link_id, payment_link_closed_at, payment_link_consumed_at, payment_link_checked_at, payment_link_error,
  payment_issue, payment_checked_at,
  owner_notification_sent_at, owner_notification_required, cancelled_at, cancelled_by,
  cancellation_reason, cancelled_from_status, cancellation_check_in::text,
  cancellation_check_out::text, parent_block_id`;

export type NewBooking = Pick<Booking, "id" | "dome" | "check_in" | "check_out" | "guests" |
  "guest_name" | "guest_email" | "guest_phone" | "billing_country" | "amount_cents" |
  "currency" | "payment_provider" | "payment_reference" | "payment_environment">;

export async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function releaseExpiredNights(client: PoolClient) {
  const expired = await client.query<{ id: string }>(`UPDATE reservations
    SET status = 'expired' WHERE status = 'pending' AND expires_at <= now() RETURNING id`);
  if (expired.rows.length) {
    await client.query("DELETE FROM reservation_nights WHERE reservation_id = ANY($1::uuid[])",
      [expired.rows.map((row) => row.id)]);
  }
}

export async function createBooking(booking: NewBooking) {
  return transaction(async (client) => {
    // Edits and new bookings lock the same dome row. The customer's accepted
    // quote is checked inside this transaction, before any hold or payment link.
    await lockPriceCalendar(client, booking.dome);
    const pricing = await readNightlyPricing(client, booking.dome, booking.check_in, booking.check_out);
    if (pricing.amountCents !== booking.amount_cents || pricing.currency !== booking.currency) {
      throw new BookingError("El precio cambió. Revisa el total actualizado y vuelve a continuar.", 409);
    }
    if (booking.amount_cents > 2147483647) throw new BookingError("Importe fuera del límite permitido.", 400);
    // Marking expired locks the reservation rows. A simultaneous confirmation
    // cannot later lose its unique night rows during cleanup.
    await releaseExpiredNights(client);
    await client.query(`INSERT INTO reservations
      (id, dome, check_in, check_out, guests, guest_name, guest_email, guest_phone,
       billing_country,
       status, amount_cents, currency, payment_provider, payment_reference, payment_environment, nightly_prices, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,$14,$15::jsonb,now() + interval '30 minutes')`,
      [booking.id, booking.dome, booking.check_in, booking.check_out, booking.guests,
        booking.guest_name, booking.guest_email, booking.guest_phone,
        booking.billing_country, booking.amount_cents,
        booking.currency, booking.payment_provider, booking.payment_reference, booking.payment_environment,
        JSON.stringify(pricing.nights)]);
    await client.query(`INSERT INTO reservation_nights (reservation_id, dome, night)
      SELECT $1, $2, day::date FROM generate_series($3::date, $4::date - 1, interval '1 day') day`,
      [booking.id, booking.dome, booking.check_in, booking.check_out]);
  });
}

export async function getBooking(id: string): Promise<Booking | null> {
  const result = await getPool().query<Booking>(`SELECT ${bookingColumns} FROM reservations WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function confirmBooking(id: string) {
  const result = await getPool().query<Booking>(`UPDATE reservations
    SET status = 'confirmed', confirmed_at = now(), expires_at = NULL
    WHERE id = $1 AND status = 'pending' AND expires_at > now()
    RETURNING ${bookingColumns}`, [id]);
  return result.rows[0] ?? null;
}

export async function savePaymentLink(id: string, linkId: string) {
  await getPool().query("UPDATE reservations SET payment_link_id = $2 WHERE id = $1 AND status = 'pending'", [id, linkId]);
}

export async function recordPaymentCheck(id: string, issue: string | null = null) {
  await getPool().query(`UPDATE reservations SET payment_checked_at = now(),
    payment_issue = COALESCE($2, payment_issue) WHERE id = $1`, [id, issue]);
}

export async function expireBooking(id: string) {
  return transaction(async (client) => {
    const result = await client.query<{ id: string }>(`UPDATE reservations SET status = 'expired'
      WHERE id = $1 AND status = 'pending' RETURNING id`, [id]);
    if (result.rows.length) {
      await client.query("DELETE FROM reservation_nights WHERE reservation_id = $1", [id]);
    }
  });
}

export async function getLocalBlocked(dome: string): Promise<OccupiedRange[]> {
  const result = await getPool().query<{ start: string; end: string }>(`
    SELECT check_in::text AS start, check_out::text AS end FROM reservations
    WHERE dome = $1 AND (status = 'confirmed' OR (status = 'pending' AND expires_at > now()))`, [dome]);
  return result.rows;
}

export async function markEmailSent(id: string) {
  await getPool().query(`UPDATE reservations SET confirmation_email_sent_at = now()
    WHERE id = $1 AND status = 'confirmed' AND confirmation_email_sent_at IS NULL`, [id]);
}
