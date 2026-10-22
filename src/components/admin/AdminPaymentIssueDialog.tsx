"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminReservation } from "@/lib/admin-calendar-view";

export type PaymentIssueResolutionInput = { action: "resolve-payment-issue"; dome: string;
  issue: string; note: string; acknowledged: boolean };

export function AdminPaymentIssueDialog({ target, domeName, busy, error, onClose, onConfirm }: {
  target: AdminReservation; domeName: string; busy: boolean; error: string;
  onClose: () => void; onConfirm: (input: PaymentIssueResolutionInput) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const [note, setNote] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    back.current?.focus();
    return () => { if (element?.open) element.close(); };
  }, []);

  return <dialog ref={dialog} aria-labelledby="payment-issue-title" aria-describedby="payment-issue-description"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-border bg-warm-white p-6 text-ink shadow-xl backdrop:bg-black/40">
    <form onSubmit={async (event) => {
      event.preventDefault();
      if (busy || !acknowledged || note.trim().length < 3 || !target.paymentIssue) return;
      await onConfirm({ action: "resolve-payment-issue", dome: target.dome,
        issue: target.paymentIssue, note, acknowledged });
    }}>
      <h2 id="payment-issue-title" className="font-serif text-2xl">¿Resolver esta incidencia?</h2>
      <p className="mt-3 font-medium">{domeName} · {target.name}</p>
      <p className="mt-1 text-sm">{target.checkIn} → {target.checkOut}</p>
      <p className="mt-2 break-all text-xs text-muted">Referencia: {target.id}</p>
      <p className="mt-4 rounded-xl bg-sand-50 p-3 text-sm">{target.paymentIssue}</p>
      <p id="payment-issue-description" className="mt-4 text-sm">El aviso dejará de aparecer entre los pagos que requieren atención.
        Se conservarán el motivo original y el registro de esta revisión. Esta acción no confirma ni anula reservas,
        no libera fechas, no cierra enlaces de pago y no realiza ni acredita un reembolso.</p>
      <fieldset disabled={busy} className="mt-4 space-y-4">
        <label className="block text-sm font-medium">Resultado de la revisión
          <textarea required minLength={3} maxLength={500} rows={3} value={note}
            placeholder="Describe cómo se atendió la incidencia."
            onChange={(event) => setNote(event.target.value)}
            className="mt-2 w-full rounded-xl border border-border bg-warm-white p-3" /></label>
        <label className="flex items-start gap-3 text-sm">
          <input required type="checkbox" checked={acknowledged} className="mt-1"
            onChange={(event) => setAcknowledged(event.target.checked)} />
          He revisado el pago en Tilopay y atendido lo que correspondía. Estoy seguro de cerrar esta incidencia.
        </label>
      </fieldset>
      {error ? <p role="alert" className="mt-4 text-sm text-red-800">{error}</p> : null}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button ref={back} type="button" disabled={busy} onClick={onClose}
          className="rounded-xl border border-border px-4 py-3 text-sm disabled:opacity-50">Volver sin cambios</button>
        <button disabled={busy || !acknowledged || note.trim().length < 3 || !target.paymentIssue}
          className="rounded-xl bg-olive-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Guardando…" : "Sí, resolver incidencia"}</button>
      </div>
    </form>
  </dialog>;
}
