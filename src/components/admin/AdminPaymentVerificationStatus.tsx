import type { AdminReservation } from "@/lib/admin-calendar-view";

export function AdminPaymentVerificationStatus({ row }: { row: AdminReservation }) {
  const diagnostic = row.paymentVerificationDiagnostic;
  if (!diagnostic) return null;
  return <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
    <p className="font-semibold">Pago sin verificar · {row.checkIn} → {row.checkOut}</p>
    <p className="mt-1">No se pudo comprobar el pago en Tilopay. Esto no demuestra que haya un cobro ni que la compra esté abandonada.
      Aunque el enlace esté cerrado, un pago podría seguir en proceso. Revisa la transacción en Tilopay antes de dar el caso por atendido.</p>
    <p className="mt-2 break-all text-xs">Reserva: {row.id}</p>
    <details className="mt-2 text-xs"><summary className="cursor-pointer">Información para soporte</summary>
      <p className="mt-1 break-all">Referencia: {diagnostic.reference}</p>
      <p>Etapa: {diagnostic.stage} · Motivo: {diagnostic.reason}
        {diagnostic.upstreamStatus ? ` · HTTP: ${diagnostic.upstreamStatus}` : ""}</p>
    </details>
  </div>;
}
