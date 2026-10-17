import type { AdminReservation } from "@/lib/admin-calendar-view";

export function AdminPaymentLinkStatus({ row, environment }: { row: AdminReservation; environment?: string }) {
  if (!row.paymentLinkState) return null;
  if (row.paymentLinkState === "consumed") return <p className="mt-2 text-sm text-muted">
    Enlace de un solo uso: pago verificado y uso consumido. La reserva sigue anulada. Esto no acredita un reembolso.
  </p>;
  if (row.paymentLinkState === "closed") return <p className="mt-2 text-sm text-muted">
    Enlace de pago cerrado en Tilopay. Esto no acredita un reembolso.
  </p>;
  if (environment && row.paymentEnvironment !== environment) return <p className="mt-2 text-sm text-muted">
    Enlace histórico de {row.paymentEnvironment}. No se consulta ni se modifica usando la configuración de {environment}.
    Su revisión debe completarse en el entorno correspondiente; la reserva no se reactiva.
  </p>;
  const diagnostic = row.paymentLinkDiagnostic;
  const description = !diagnostic ? "Aún no se ha confirmado el estado del enlace en Tilopay."
    : diagnostic.reason === "http" && diagnostic.upstreamStatus === 401 ? "Tilopay rechazó la autenticación de esta consulta."
    : diagnostic.reason === "timeout" || diagnostic.reason === "network" ? "No se pudo completar la conexión con Tilopay."
    : diagnostic.reason === "link_mismatch" ? "El enlace recibido no coincide con esta reserva; no se modificó."
    : diagnostic.stage === "tilopay_close" && diagnostic.reason === "rejected" ? "Tilopay no confirmó el cierre solicitado."
    : "No se pudo verificar o completar la gestión del enlace en Tilopay.";
  return <div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
    <p>{description} {row.status === "cancelled" ? "La reserva permanece anulada." : "La solicitud permanece vencida."} Este aviso no demuestra que el enlace permita otro pago.</p>
    <p className="mt-2 text-xs">Puedes pulsar «Revisar enlace de pago». Los intentos se separan al menos dos minutos; el respaldo también reintenta si está habilitado.</p>
    {row.paymentLinkCheckedAt ? <p className="mt-2 text-xs">Último intento: {new Date(row.paymentLinkCheckedAt).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}</p> : null}
    {diagnostic ? <details className="mt-2 text-xs"><summary className="cursor-pointer">Información para soporte</summary>
      <p className="mt-1 break-all">Referencia: {diagnostic.reference}</p>
      <p>Etapa: {diagnostic.stage} · Motivo: {diagnostic.reason}
        {diagnostic.upstreamStatus ? ` · HTTP: ${diagnostic.upstreamStatus}` : ""}
        {diagnostic.providerCode ? ` · Código Tilopay: ${diagnostic.providerCode}` : ""}
        {diagnostic.providerStatus ? ` · Estado Tilopay: ${diagnostic.providerStatus}` : ""}</p>
    </details> : null}
  </div>;
}
