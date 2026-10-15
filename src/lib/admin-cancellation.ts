import "server-only";
import { randomUUID } from "node:crypto";
import { bookingColumns, transaction, type Booking } from "@/lib/booking-db";
import { BookingError } from "@/lib/booking-error";
import { cleanField, validDate, validReservationId } from "@/lib/booking-validation";
import { getDome } from "@/data/domes";
import { closeInactivePaymentLink } from "@/lib/tilopay";
import { logServerError } from "@/lib/safe-log";

export async function cancelLocalReservation(id: string, input: Record<string, unknown>, actor: string,
  manualOnly = false) {
  if (!validReservationId(id)) throw new BookingError("Reserva inválida.", 400);
  const dome = cleanField(input.dome, 40);
  if (!getDome(dome)) throw new BookingError("Domo desconocido.", 400);
  const reason = cleanField(input.reason, 300);
  if (reason.length < 3) throw new BookingError("Detalla el motivo de la anulación (mínimo 3 caracteres).", 400);
  if (input.acknowledged !== true) throw new BookingError("Confirma las consecuencias de la anulación.", 400);
  const username = cleanField(actor, 80);

  const result = await transaction(async (client) => {
    // This row lock serializes cancellation, payment confirmation and mail.
    const { rows } = await client.query<Booking>(`SELECT ${bookingColumns} FROM reservations WHERE id = $1 FOR UPDATE`, [id]);
    const row = rows[0];
    if (!row || row.dome !== dome || (manualOnly && row.kind !== "manual")) {
      throw new BookingError("Reserva o bloqueo no encontrado en este domo.", 404);
    }
    if (row.payment_provider === "tilopay" && input.acknowledgeNoRefund !== true) {
      throw new BookingError("Debes aceptar que esta acción no realiza ni acredita un reembolso.", 400);
    }
    // Replaying an action must never free nights belonging to replacement
    // bookings/blocks, nor replace the original cancellation reason/actor.
    if (row.status === "cancelled") return { booking: row, alreadyCancelled: true, remaining: [] as string[] };

    const start = input.start === undefined ? row.check_in : cleanField(input.start, 10);
    const end = input.end === undefined ? row.check_out : cleanField(input.end, 10);
    if (!validDate(start) || !validDate(end) || start < row.check_in || end > row.check_out || start >= end ||
      (row.kind !== "manual" && (start !== row.check_in || end !== row.check_out))) {
      throw new BookingError("Rango inválido: una reserva se anula completa; un bloqueo permite liberar noches dentro de su rango.", 400);
    }
    if (row.kind === "manual" && row.status !== "confirmed") throw new BookingError("El bloqueo no está activo.", 409);
    const updated = await client.query<Booking>(`UPDATE reservations SET
      status = 'cancelled', expires_at = NULL, cancelled_at = now(), cancelled_by = $2,
      cancellation_reason = $3, cancelled_from_status = status,
      cancellation_check_in = $4::date, cancellation_check_out = $5::date
      WHERE id = $1 RETURNING ${bookingColumns}`, [id, username, reason, start, end]);
    await client.query("DELETE FROM reservation_nights WHERE reservation_id = $1", [id]);

    const remaining: string[] = [];
    // A partial manual release replaces the original with up to two blocks.
    // Their night locks and history are committed atomically with the release.
    if (row.kind === "manual") {
      for (const [first, last] of [[row.check_in, start], [end, row.check_out]]) {
        if (first >= last) continue;
        const childId = randomUUID();
        await client.query(`INSERT INTO reservations (id, dome, check_in, check_out, guests,
          guest_name, guest_email, guest_phone, billing_country, status, amount_cents,
          currency, payment_provider, kind, admin_note, confirmed_at, parent_block_id)
          VALUES ($1,$2,$3::date,$4::date,1,'Administrador','','','','confirmed',0,$5,'manual','manual',$6,now(),$7)`,
        [childId, dome, first, last, row.currency, row.admin_note, id]);
        await client.query(`INSERT INTO reservation_nights (reservation_id,dome,night)
          SELECT $1,$2,day::date FROM generate_series($3::date,$4::date - 1,interval '1 day') day`,
        [childId, dome, first, last]);
        remaining.push(childId);
      }
    }
    return { booking: updated.rows[0], alreadyCancelled: false, remaining };
  });

  // Never roll back a committed cancellation because the provider is down.
  // Persisted status/link markers let scheduled reconciliation retry the close
  // and detect an unverified payment that arrives after cancellation.
  let linkClosePending = false;
  try { await closeInactivePaymentLink(result.booking); }
  catch (error) { linkClosePending = true; logServerError("Cancelled payment link cleanup failed", error); }
  return { alreadyCancelled: result.alreadyCancelled, remainingBlocks: result.remaining,
    warning: (result.alreadyCancelled ? "El registro ya estaba anulado. " : result.booking.kind === "manual"
      ? "Noches liberadas del bloqueo manual. " : "Reserva anulada. ") + (result.booking.payment_provider === "tilopay"
      ? "La anulación no realiza ni acredita un reembolso. Comprueba el pago o reembolso en Tilopay. " : "") +
      (linkClosePending ? "No se pudo cerrar el enlace de pago; el respaldo reintentará. Si llega un pago, requiere revisión. " : "") +
      "Las noches se liberan solo de esta reserva o bloqueo web. Si siguen ocupadas por Airbnb o Expedia, revísalas en su plataforma; Expedia puede requerir reapertura manual." };
}
