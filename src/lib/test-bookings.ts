import { getPool } from "@/lib/booking-db";

export async function cancelTestBooking(id: string) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ id: string }>(`UPDATE reservations SET status = 'cancelled',
      cancelled_at = now(), cancelled_by = 'cliente', cancelled_from_status = status,
      cancellation_reason = 'Anulación de reserva sin cobro por quien la solicitó',
      cancellation_check_in = check_in, cancellation_check_out = check_out, expires_at = NULL
      WHERE id = $1 AND payment_provider = 'test' AND status = 'confirmed' RETURNING id`, [id]);
    if (result.rows.length) {
      await client.query("DELETE FROM reservation_nights WHERE reservation_id = $1", [id]);
    }
    await client.query("COMMIT");
    return result.rows.length > 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
