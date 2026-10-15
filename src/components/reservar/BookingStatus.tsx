"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { validReservationId } from "@/lib/booking-validation";
import { getDome } from "@/data/domes";

type Status = { id: string; status: string; dome: string; checkIn: string; checkOut: string;
  amountCents: number; currency: string; emailSent: boolean; testMode: boolean; simulatedPayment: boolean };

export function BookingStatus() {
  const id = useSearchParams().get("id");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [testSecret, setTestSecret] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    if (!id || !validReservationId(id)) return;
    let live = true;
    let done = false;
    let inFlight = false;
    let attempts = 0;
    let timer: number | undefined;
    const controller = new AbortController();
    async function refresh() {
      if (!live || done || document.hidden || inFlight || attempts >= 30) return;
      if (timer !== undefined) window.clearTimeout(timer);
      inFlight = true;
      attempts++;
      try {
        const response = await fetch(`/api/reservations/${id}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) {
          const reference = typeof result.requestId === "string" && /^[a-f0-9-]{36}$/.test(result.requestId)
            ? ` Referencia de soporte: ${result.requestId}.` : "";
          throw new Error((result.error ?? "No se pudo verificar el estado del pago. No vuelvas a pagar si Tilopay ya lo aprobó.") + reference);
        }
        if (live) { setStatus(result); setError(""); done = result.status !== "pending"; }
      } catch (reason) { if (live) setError(reason instanceof Error ? reason.message : "Error desconocido"); }
      finally {
        inFlight = false;
        if (live && !done && !document.hidden && attempts < 30) timer = window.setTimeout(refresh, 10_000);
      }
    }
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => { live = false; controller.abort(); window.clearTimeout(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [id, refreshVersion]);

  async function cancelTest() {
    if (!id || cancelling) return;
    setCancelling(true);
    setError("");
    try {
      const response = await fetch(`/api/reservations/${id}/cancel-test`, {
        method: "POST", headers: { "x-booking-test-secret": testSecret },
      });
      if (!response.ok) throw new Error("No se pudo cancelar la reserva sin cobro. Revisa la clave.");
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
    {id && !validReservationId(id) ? <p role="alert" className="mt-4 text-red-700">El número de reserva no es válido.</p> : null}
    {error ? <p role="alert" className="mt-4 text-red-700">{error}</p> : null}
    {id ? <button type="button" onClick={() => setRefreshVersion((value) => value + 1)}
      className="mt-4 text-sm font-medium text-olive-800 underline">Actualizar estado</button> : null}
    {!status && id && validReservationId(id) ? <p className="mt-4 text-muted">
      {error ? "La reserva aún no está confirmada. Conserva su identificador y no repitas un pago aprobado." : "Verificando el pago…"}
      <span className="mt-2 block text-xs">Reserva: {id}</span>
    </p> : null}
    {status ? <div className="mt-6 space-y-3 text-sm text-ink">
      <p><strong>Reserva:</strong> {status.id}</p>
      <p><strong>Domo:</strong> {getDome(status.dome)?.name ?? status.dome}</p>
      <p><strong>Estadía:</strong> {status.checkIn} al {status.checkOut}</p>
      <p><strong>{!status.simulatedPayment && status.status === "confirmed" ? "Total pagado:" : "Importe de la estadía:"}</strong> {amount}</p>
      {status.simulatedPayment ? <p className="text-sm text-muted">Esta operación no genera un cargo real.</p> : null}
      {status.status === "confirmed" ? <p className="rounded-2xl bg-olive-50 p-4 font-medium text-olive-800">
        Reserva confirmada. {status.emailSent ? "Enviamos los detalles por correo." : "El correo de confirmación está pendiente; conserva este número de reserva."}
      </p> : status.status === "pending" ? <p className="rounded-2xl bg-sand-50 p-4">
        Pago aún no verificado. No consideres esta reserva confirmada hasta que cambie el estado.
      </p> : status.status === "cancelled" ? <p className="rounded-2xl bg-sand-50 p-4">
        Reserva cancelada; las noches se liberaron en esta web y desaparecerán del iCal de salida.
        Expedia puede conservar el bloqueo; el administrador deberá comprobarlo y reabrir las noches manualmente si corresponde.
      </p> : <p className="rounded-2xl bg-sand-50 p-4">
        El bloqueo de esta reserva expiró. Si se realizó un cargo, contacta al alojamiento con tu número de reserva.
      </p>}
      {status.testMode && status.status === "confirmed" && process.env.NEXT_PUBLIC_BOOKING_TEST_MODE === "true" ?
        <div className="mt-5 rounded-2xl border border-border p-4">
          <p className="font-medium">Cancelar esta reserva sin cobro</p>
          <label className="mt-3 block">Clave de acceso
            <input type="password" autoComplete="off" value={testSecret}
              onChange={(event) => setTestSecret(event.target.value)}
              className="mt-2 w-full rounded-xl border border-border p-3" />
          </label>
          <button type="button" disabled={cancelling || !testSecret} onClick={cancelTest}
            className="mt-3 rounded-xl bg-olive-700 px-4 py-3 text-white disabled:opacity-50">
            {cancelling ? "Cancelando…" : "Cancelar reserva y liberar noches"}
          </button>
        </div> : null}
    </div> : null}
  </div>;
}
