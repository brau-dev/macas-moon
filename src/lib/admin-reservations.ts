import "server-only";
import { randomUUID } from "node:crypto";
import { getDome } from "@/data/domes";
import { isDomeActive } from "@/lib/active-domes";
import { BookingError } from "@/lib/booking-error";
import { bookingColumns, getPool, getBooking, releaseExpiredNights, transaction, type Booking } from "@/lib/booking-db";
import { cancelLocalReservation } from "@/lib/admin-cancellation";
import { cleanField, validateStay } from "@/lib/booking-validation";
import { getCalendarSources } from "@/lib/ical";
import { getCombinedAvailability } from "@/lib/combined-availability";
import { overlapsBlocked } from "@/lib/availability-types";

export function validateAdminDome(dome: string) {
  if (!getDome(dome) || !isDomeActive(dome)) throw new BookingError("Domo no habilitado.", 400);
}

export async function adminCalendar(dome: string, start: string, end: string, refresh: boolean) {
  // An administrator can inspect either property even before online sales are enabled.
  // Mutations still require an active dome and fully verified calendars.
  if (!getDome(dome)) throw new BookingError("Domo desconocido.", 400);
  const [imported, reservations, issues] = await Promise.all([
    getCalendarSources(dome, refresh),
    getPool().query<Booking>(`SELECT ${bookingColumns} FROM reservations
      WHERE dome = $1 AND check_in < $3::date AND check_out > $2::date ORDER BY check_in, created_at`, [dome, start, end]),
    getPool().query<Booking>(`SELECT ${bookingColumns} FROM reservations
      WHERE dome = $1 AND payment_issue IS NOT NULL ORDER BY created_at DESC LIMIT 50`, [dome]),
  ]);
  // Viewing a calendar must not run cleanup transactions. Expired holds are
  // displayed correctly without writes; booking/block creation still releases
  // them atomically before acquiring the unique night rows.
  const now = Date.now();
  const expose = (row: Booking) => ({ id: row.id, dome: row.dome, checkIn: row.check_in, checkOut: row.check_out,
    kind: row.kind, status: row.status === "pending" && row.expires_at && row.expires_at.valueOf() <= now ? "expired" : row.status,
    name: row.guest_name, email: row.guest_email, phone: row.guest_phone,
    country: row.billing_country, guests: row.guests, amountCents: row.amount_cents, currency: row.currency,
    provider: row.payment_provider, note: row.admin_note, expiresAt: row.expires_at?.toISOString() ?? null,
    emailSent: Boolean(row.confirmation_email_sent_at), ownerEmailRequired: row.owner_notification_required,
    ownerEmailSent: Boolean(row.owner_notification_sent_at), paymentIssue: row.payment_issue,
    cancelledAt: row.cancelled_at?.toISOString() ?? null, cancelledBy: row.cancelled_by,
    cancellationReason: row.cancellation_reason, cancelledFrom: row.cancelled_from_status,
    cancellationStart: row.cancellation_check_in, cancellationEnd: row.cancellation_check_out,
    parentBlockId: row.parent_block_id,
    paymentLinkPending: Boolean(row.status === "cancelled" && row.payment_link_id && !row.payment_link_closed_at) });
  return { dome, bookingEnabled: isDomeActive(dome), reservations: reservations.rows.map(expose), issues: issues.rows.map(expose),
    imported: imported.map((source) => ({ ...source,
      blocked: source.blocked.filter((range) => range.start < end && range.end > start) })),
    checkedAt: new Date().toISOString() };
}

export async function createManualBlock(body: Record<string, unknown>) {
  const dome = cleanField(body.dome, 40);
  validateAdminDome(dome);
  const checkIn = cleanField(body.checkIn, 10);
  const checkOut = cleanField(body.checkOut, 10);
  validateStay(checkIn, checkOut, 365, true);
  const note = cleanField(body.note, 300);
  const availability = await getCombinedAvailability(dome, true);
  if (availability.status !== "ready") throw new BookingError("No se pudieron verificar Airbnb y Expedia. No se creó el bloqueo.", 503);
  if (overlapsBlocked(checkIn, checkOut, availability.blocked)) throw new BookingError("El rango contiene noches ya ocupadas.", 409);
  const id = randomUUID();
  try {
    await transaction(async (client) => {
      await releaseExpiredNights(client);
      await client.query(`INSERT INTO reservations (id, dome, check_in, check_out, guests,
        guest_name, guest_email, guest_phone, billing_country, status, amount_cents, currency,
        payment_provider, kind, admin_note, confirmed_at)
        VALUES ($1,$2,$3,$4,1,'Administrador','','','', 'confirmed',0,'USD','manual','manual',$5,now())`,
      [id, dome, checkIn, checkOut, note]);
      await client.query(`INSERT INTO reservation_nights (reservation_id, dome, night)
        SELECT $1,$2,day::date FROM generate_series($3::date,$4::date - 1,interval '1 day') day`,
      [id, dome, checkIn, checkOut]);
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      throw new BookingError("Las noches acaban de ocuparse. Actualiza el calendario.", 409);
    }
    throw error;
  }
  return id;
}

export async function removeManualBlock(id: string) {
  const booking = await getBooking(id);
  if (!booking || booking.kind !== "manual") throw new BookingError("Bloqueo no encontrado.", 404);
  return cancelLocalReservation(id, { dome: booking.dome, reason: "Retiro de bloqueo desde el panel",
    acknowledged: true }, process.env.ADMIN_USERNAME ?? "administrador", true);
}
