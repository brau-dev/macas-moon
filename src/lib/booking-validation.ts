import { BookingError } from "@/lib/booking-error";
import { nightsBetween, todayInCostaRica } from "@/lib/date-range";

export function validReservationId(value: string) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}

export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateStay(start: string, end: string, maxNights = 30, allowToday = false) {
  if (!validDate(start) || !validDate(end) ||
    (allowToday ? start < todayInCostaRica() : start <= todayInCostaRica()) ||
    nightsBetween(start, end) < 1 || nightsBetween(start, end) > maxNights) {
    throw new BookingError("Fechas inválidas.", 400);
  }
}

export function cleanField(value: unknown, max: number) {
  if (typeof value !== "string") throw new BookingError("Datos incompletos.", 400);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) throw new BookingError("Datos inválidos.", 400);
  return trimmed;
}
