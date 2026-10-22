import "server-only";
import { randomUUID } from "node:crypto";
import { BookingError } from "@/lib/booking-error";
import { transaction } from "@/lib/booking-db";
import { cleanField, validReservationId } from "@/lib/booking-validation";
import { getDome } from "@/data/domes";

// Called only after administrator authentication and same-origin validation.
// No provider calls, refunds, reservation changes, emails or availability writes.
export async function resolvePaymentIssue(id: string, input: Record<string, unknown>, actor: string) {
  if (!validReservationId(id)) throw new BookingError("Reserva inválida.", 400);
  const dome = cleanField(input.dome, 40);
  if (!getDome(dome)) throw new BookingError("Domo desconocido.", 400);
  if (input.acknowledged !== true) throw new BookingError("Confirma que deseas cerrar esta incidencia.", 400);
  const issue = cleanField(input.issue, 2000);
  const note = cleanField(input.note, 500);
  if (note.length < 3) throw new BookingError("Indica el resultado de la revisión (mínimo 3 caracteres).", 400);
  const username = cleanField(actor, 80);
  return transaction(async (client) => {
    // Serialize with reconciliation/cancellation and reject stale confirmations.
    const { rows } = await client.query<{ dome: string; payment_issue: string | null }>(
      "SELECT dome, payment_issue FROM reservations WHERE id = $1 FOR UPDATE", [id]);
    const booking = rows[0];
    if (!booking || booking.dome !== dome) throw new BookingError("Reserva no encontrada en este domo.", 404);
    if (!booking.payment_issue || booking.payment_issue !== issue) {
      throw new BookingError("La incidencia cambió o ya no existe. Actualiza el panel y vuelve a revisarla.", 409);
    }
    const result = await client.query(`INSERT INTO payment_issue_resolutions
      (id, reservation_id, issue, note, resolved_by) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (reservation_id, issue) DO NOTHING RETURNING id`, [randomUUID(), id, issue, note, username]);
    return { alreadyResolved: result.rows.length === 0 };
  });
}
