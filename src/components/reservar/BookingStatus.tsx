"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Status = { id: string; status: string; dome: string; checkIn: string; checkOut: string;
  amountCents: number; currency: string; emailSent: boolean; testMode: boolean };

export function BookingStatus() {
  const id = useSearchParams().get("id");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [testSecret, setTestSecret] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) return;
    let live = true;
    async function refresh() {
      try {
        const response = await fetch(`/api/reservations/${id}`, { cache: "no-store" });
        if (!response.ok) throw new Error("No se pudo verificar el estado del pago.");
        const result = await response.json() as Status;
        if (live) { setStatus(result); setError(""); }
      } catch (reason) { if (live) setError(reason instanceof Error ? reason.message : "Error desconocido"); }
    }
    refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [id]);

  async function cancelTest() {
    if (!id || cancelling) return;
    setCancelling(true);
    setError("");
    try {
      const response = await fetch(`/api/reservations/${id}/cancel-test`, {
        method: "POST", headers: { "x-booking-test-secret": testSecret },
      });
      if (!response.ok) throw new Error("No se pudo cancelar la reserva de prueba. Revisa la clave.");
      setStatus((current) => current ? { ...current, status: "cancelled" } : current);
      setTestSecret("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Error desconocido"); }
    finally { setCancelling(false); }
  }

  const amount = status ? new Intl.NumberFormat("es-CR", { style: "currency", currency: status.currency })
    .format(status.amountCents / 100) : "";
  return <div className="rounded-3xl border border-border-soft bg-warm-white p-6 shadow-soft sm:p-10">
    <h1 className="heading-section text-ink">Estado de tu reserva</h1>
    {!id ? <p className="mt-4 text-muted">No se proporcionó un número de reserva.</p> : null}
    {error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : null}
    {!status && id ? <p className="mt-4 text-muted">Verificando el pago…</p> : null}
    {status ? <div className="mt-6 space-y-3 text-sm text-ink">
      <p><strong>Reserva:</strong> {status.id}</p>
      <p><strong>Domo:</strong> {status.dome}</p>
      <p><strong>Estadía:</strong> {status.checkIn} al {status.checkOut}</p>
      <p><strong>{status.testMode ? "Prueba sin cobro. Tarifa simulada:" : "Total pagado:"}</strong> {amount}</p>
      {status.status === "confirmed" ? <p className="rounded-2xl bg-olive-50 p-4 font-medium text-olive-800">
        Reserva confirmada. {status.emailSent ? "Enviamos los detalles por correo." : "El correo de confirmación está pendiente; conserva este número de reserva."}
      </p> : status.status === "pending" ? <p className="rounded-2xl bg-sand-50 p-4">
        Pago aún no verificado. No consideres esta reserva confirmada hasta que cambie el estado.
      </p> : status.status === "cancelled" ? <p className="rounded-2xl bg-sand-50 p-4">
        Reserva de prueba cancelada; las noches se liberaron en esta web y desaparecerán del iCal de salida.
      </p> : <p className="rounded-2xl bg-sand-50 p-4">
        El bloqueo de esta reserva expiró. Si se realizó un cargo, contacta al alojamiento con tu número de reserva.
      </p>}
      {status.testMode && status.status === "confirmed" && process.env.NEXT_PUBLIC_BOOKING_TEST_MODE === "true" ?
        <div className="mt-5 rounded-2xl border border-border p-4">
          <p className="font-medium">Cancelar esta reserva de prueba</p>
          <label className="mt-3 block">Clave de prueba
            <input type="password" autoComplete="off" value={testSecret}
              onChange={(event) => setTestSecret(event.target.value)}
              className="mt-2 w-full rounded-xl border border-border p-3" />
          </label>
          <button type="button" disabled={cancelling || !testSecret} onClick={cancelTest}
            className="mt-3 rounded-xl bg-olive-700 px-4 py-3 text-white disabled:opacity-50">
            {cancelling ? "Cancelando…" : "Cancelar prueba y liberar noches"}
          </button>
        </div> : null}
    </div> : null}
  </div>;
}
