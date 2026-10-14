import "server-only";
import { Pool, type PoolClient } from "pg";
import type { OccupiedRange } from "@/lib/availability-types";

let pool: Pool | undefined;

export function getPool() {
  const connectionString = process.env.NETLIFY_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Neither NETLIFY_DB_URL nor DATABASE_URL is configured");
  pool ??= new Pool({ connectionString, max: 3 });
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
  payment_reference: string | null;
  kind: "booking" | "manual";
  admin_note: string;
  payment_link_id: string | null;
  payment_link_closed_at: Date | null;
  payment_issue: string | null;
  payment_checked_at: Date | null;
  expires_at: Date | null;
  confirmation_email_sent_at: Date | null;
  owner_notification_sent_at: Date | null;
  owner_notification_required: boolean;
};

export const bookingColumns = `id, dome, check_in::text, check_out::text, guests, guest_name, guest_email,
  guest_phone, billing_address, billing_city, billing_state, billing_postal_code,
  billing_country, status, amount_cents, currency, payment_provider,
  payment_reference, expires_at, confirmation_email_sent_at, kind, admin_note,
  payment_link_id, payment_link_closed_at, payment_issue, payment_checked_at,
  owner_notification_sent_at, owner_notification_required`;

export type NewBooking = Pick<Booking, "id" | "dome" | "check_in" | "check_out" | "guests" |
  "guest_name" | "guest_email" | "guest_phone" | "billing_country" | "amount_cents" |
  "currency" | "payment_provider" | "payment_reference">;

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
    // Marking expired locks the reservation rows. A simultaneous confirmation
    // cannot later lose its unique night rows during cleanup.
    await releaseExpiredNights(client);
    await client.query(`INSERT INTO reservations
      (id, dome, check_in, check_out, guests, guest_name, guest_email, guest_phone,
       billing_country,
       status, amount_cents, currency, payment_provider, payment_reference, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13,now() + interval '30 minutes')`,
      [booking.id, booking.dome, booking.check_in, booking.check_out, booking.guests,
        booking.guest_name, booking.guest_email, booking.guest_phone,
        booking.billing_country, booking.amount_cents,
        booking.currency, booking.payment_provider, booking.payment_reference]);
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
