"use client";

import { useEffect, useRef, useState } from "react";

export type CancellationTarget = { id: string; dome: string; kind: "booking" | "manual";
  provider: string; name: string; checkIn: string; checkOut: string };
export type CancellationInput = { action: "cancel"; dome: string; reason: string;
  acknowledged: boolean; acknowledgeNoRefund: boolean; start: string; end: string };

export function AdminCancellationDialog({ target, domeName, busy, error, onClose, onConfirm }: {
  target: CancellationTarget; domeName: string; busy: boolean; error: string;
  onClose: () => void; onConfirm: (input: CancellationInput) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [start, setStart] = useState(target.checkIn);
  const [end, setEnd] = useState(target.checkOut);
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledgeNoRefund, setAcknowledgeNoRefund] = useState(false);
  const manual = target.kind === "manual";
  const financial = target.provider === "tilopay";
  const field = "mt-2 w-full rounded-xl border border-border bg-warm-white p-3";
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  return <dialog ref={dialog} aria-labelledby="cancellation-title" aria-describedby="cancellation-description" onCancel={(event) => {
    event.preventDefault(); if (!busy) onClose();
  }} className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-border bg-warm-white p-6 text-ink shadow-xl backdrop:bg-black/40">
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (busy) return;
      await onConfirm({ action: "cancel", dome: target.dome, reason, acknowledged, acknowledgeNoRefund, start, end });
    }}>
      <h2 id="cancellation-title" className="font-serif text-2xl">Liberar fechas</h2>
      <p className="mt-3 font-medium">{domeName} · {manual ? "Bloqueo manual" : target.name}</p>
      <p className="mt-1 text-sm">{target.checkIn} → {target.checkOut}</p>
      <p className="mt-2 break-all text-xs text-muted">ID: {target.id}</p>
      <p id="cancellation-description" className="mt-4 text-sm">{manual
        ? "Puedes liberar todo el bloqueo o solo algunas noches. El resto permanecerá bloqueado. El último día es la salida y no se incluye."
        : "Se anulará la reserva completa. Se conservarán su historial y los datos de pago; no se modificará el importe ni se emitirá un reembolso."}</p>
      <fieldset disabled={busy} className="mt-4 space-y-4">
        {manual ? <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Desde (primera noche)
            <input required type="date" min={target.checkIn} max={target.checkOut} value={start}
              onChange={(event) => setStart(event.target.value)} className={field} /></label>
          <label className="text-sm font-medium">Hasta (día de salida)
            <input required type="date" min={start} max={target.checkOut} value={end}
              onChange={(event) => setEnd(event.target.value)} className={field} /></label>
        </div> : null}
        <label className="block text-sm font-medium">Motivo
          <textarea required minLength={3} maxLength={300} rows={3} value={reason}
            onChange={(event) => setReason(event.target.value)} className={field} /></label>
        <label className="flex items-start gap-3 text-sm">
          <input required type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-1" />
          Confirmo que deseo liberar estas fechas en esta web. Las reservas o cierres importados se gestionan en su plataforma. Comprobaré la reapertura en Expedia.
        </label>
        {financial ? <label className="flex items-start gap-3 text-sm">
          <input required type="checkbox" checked={acknowledgeNoRefund} onChange={(event) => setAcknowledgeNoRefund(event.target.checked)} className="mt-1" />
          Entiendo que esta acción no realiza ni acredita un reembolso. Revisaré en Tilopay cualquier pago aprobado o que esté en proceso.
        </label> : null}
      </fieldset>
      {error ? <p role="alert" className="mt-4 text-sm text-red-800">{error}</p> : null}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-border px-4 py-3 text-sm disabled:opacity-50">Volver sin cambios</button>
        <button disabled={busy || !acknowledged || (financial && !acknowledgeNoRefund) || reason.trim().length < 3 || start >= end}
          className="rounded-xl bg-red-800 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Guardando…" : "Confirmar liberación"}</button>
      </div>
    </form>
  </dialog>;
}
