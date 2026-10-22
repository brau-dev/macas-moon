import type { CalendarSource } from "@/lib/ical";
import { validDate } from "@/lib/booking-validation";
import type { PaymentLinkDiagnostic } from "@/lib/checkout-error";

export type PaymentIssueResolution = { resolvedAt: string; resolvedBy: string; note: string };

// Used only by authenticated administrator views. These fields must not be
// added to public availability or iCal responses.
export type AdminReservation = { id: string; dome: string; checkIn: string; checkOut: string; kind: "booking" | "manual";
  status: "pending" | "confirmed" | "cancelled" | "expired"; name: string; email: string; phone: string;
  country: string; guests: number; amountCents: number; currency: string; provider: string; note: string;
  paymentEnvironment: "Test" | "Production";
  expiresAt: string | null; emailSent: boolean; ownerEmailRequired: boolean; ownerEmailSent: boolean; paymentIssue: string | null;
  paymentIssueResolution: PaymentIssueResolution | null;
  cancelledAt: string | null; cancelledBy: string | null; cancellationReason: string | null;
  cancelledFrom: string | null; cancellationStart: string | null; cancellationEnd: string | null;
  parentBlockId: string | null; paymentLinkPending: boolean;
  paymentLinkState: "closed" | "consumed" | "pending" | null;
  paymentLinkCheckedAt: string | null; paymentLinkDiagnostic: PaymentLinkDiagnostic | null };

export const adminReservationStatusLabels = {
  pending: "Pago pendiente", confirmed: "Confirmada", expired: "Solicitud vencida", cancelled: "Anulada",
};

export function isActiveAdminReservation(row: Pick<AdminReservation, "status" | "expiresAt">, now = Date.now()) {
  return row.status === "confirmed" ||
    (row.status === "pending" && Boolean(row.expiresAt && new Date(row.expiresAt).valueOf() > now));
}

export function getAdminDayReservations(rows: AdminReservation[], dome: string, day: string, now = Date.now()) {
  if (!validDate(day)) return [];
  // Checkout is exclusive. Old attempts and other properties must not be
  // mistaken for the guest currently occupying the clicked night.
  return rows.filter((row) => row.dome === dome && isActiveAdminReservation(row, now) &&
    row.checkIn <= day && day < row.checkOut);
}

export function getAdminDaySources(sources: CalendarSource[], day: string) {
  if (!validDate(day)) return [];
  return sources.filter((source) => source.blocked.some((range) => range.start <= day && day < range.end));
}
