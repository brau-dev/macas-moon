import type { AdminReservation } from "@/lib/admin-calendar-view";

export function AdminPaymentIssue({ row, busy, onResolve }: { row: AdminReservation; busy: boolean;
  onResolve: (row: AdminReservation) => void }) {
  if (!row.paymentIssue || row.paymentIssueResolution) return null;
  return <article className="mt-3 rounded-xl border border-red-200 p-3 text-sm text-red-800">
    <p className="font-semibold">{row.name} · {row.checkIn} → {row.checkOut}</p>
    <p className="mt-1">{row.paymentIssue}</p>
    <p className="mt-2 break-all text-xs">Referencia de reserva: {row.id}</p>
    <button type="button" disabled={busy} onClick={() => onResolve(row)}
      className="mt-3 rounded-xl border border-red-300 bg-warm-white px-3 py-2 font-medium disabled:opacity-50">Resolver incidencia</button>
  </article>;
}

export function AdminResolvedPaymentIssue({ row }: { row: AdminReservation }) {
  const resolution = row.paymentIssueResolution;
  if (!row.paymentIssue || !resolution) return null;
  return <details className="mt-3 rounded-xl bg-olive-50 p-3 text-sm text-olive-900">
    <summary className="cursor-pointer font-medium">Incidencia resuelta</summary>
    <p className="mt-2">Motivo original: {row.paymentIssue}</p>
    <p className="mt-2 whitespace-pre-wrap">Resultado: {resolution.note}</p>
    <p className="mt-2 text-xs">Revisada por {resolution.resolvedBy} · {new Date(resolution.resolvedAt).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}</p>
  </details>;
}
