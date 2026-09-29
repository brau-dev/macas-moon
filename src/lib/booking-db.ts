import { Pool, type PoolClient } from "pg";
import type { OccupiedRange } from "@/lib/availability-types";

let pool: Pool | undefined;

export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  pool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
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
  payment_provider: "tilopay" | "test";
  payment_reference: string | null;
  expires_at: Date | null;
  confirmation_email_sent_at: Date | null;
};

const columns = `id, dome, check_in::text, check_out::text, guests, guest_name, guest_email,
  guest_phone, billing_address, billing_city, billing_state, billing_postal_code,
  billing_country, status, amount_cents, currency, payment_provider,
  payment_reference, expires_at, confirmation_email_sent_at`;

async function transaction<T>(run: (client: PoolClient) => Promise<T>) {
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

export async function createBooking(booking: Omit<Booking, "status" | "expires_at" | "confirmation_email_sent_at">) {
  return transaction(async (client) => {
    // Marking expired locks the reservation rows. A simultaneous confirmation
    // cannot later lose its unique night rows during cleanup.
    const expired = await client.query<{ id: string }>(`UPDATE reservations
      SET status = 'expired' WHERE status = 'pending' AND expires_at < now() RETURNING id`);
    if (expired.rows.length) {
      await client.query("DELETE FROM reservation_nights WHERE reservation_id = ANY($1::uuid[])",
        [expired.rows.map((row) => row.id)]);
    }
    await client.query(`INSERT INTO reservations
      (id, dome, check_in, check_out, guests, guest_name, guest_email, guest_phone,
       billing_address, billing_city, billing_state, billing_postal_code, billing_country,
       status, amount_cents, currency, payment_provider, payment_reference, expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',$14,$15,$16,$17,now() + interval '30 minutes')`,
      [booking.id, booking.dome, booking.check_in, booking.check_out, booking.guests,
        booking.guest_name, booking.guest_email, booking.guest_phone,
        booking.billing_address, booking.billing_city, booking.billing_state,
        booking.billing_postal_code, booking.billing_country, booking.amount_cents,
        booking.currency, booking.payment_provider, booking.payment_reference]);
    await client.query(`INSERT INTO reservation_nights (reservation_id, dome, night)
      SELECT $1, $2, day::date FROM generate_series($3::date, $4::date - 1, interval '1 day') day`,
      [booking.id, booking.dome, booking.check_in, booking.check_out]);
  });
}

export async function getBooking(id: string): Promise<Booking | null> {
  const result = await getPool().query<Booking>(`SELECT ${columns} FROM reservations WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function confirmBooking(id: string) {
  const result = await getPool().query<Booking>(`UPDATE reservations
    SET status = 'confirmed', confirmed_at = now(), expires_at = NULL
    WHERE id = $1 AND status = 'pending' AND expires_at > now()
    RETURNING ${columns}`, [id]);
  return result.rows[0] ?? null;
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
