"use client";

import { useId, useRef } from "react";
import { CircleHelp, X } from "lucide-react";
import { cn } from "@/lib/cn";

export const calendarDotColors = {
  web: "bg-olive-700",
  manual: "bg-purple-500",
  pending: "bg-amber-500",
  airbnb: "bg-rose-500",
  expedia: "bg-blue-500",
};

const entries = [
  { key: "web", color: "Verde", label: "Reserva web confirmada",
    description: "Esta noche tiene una reserva confirmada hecha en la página de Macas Moon." },
  { key: "manual", color: "Morado", label: "Bloqueo manual",
    description: "La administración apartó esta noche, por ejemplo, por mantenimiento o por una reserva gestionada directamente." },
  { key: "pending", color: "Ámbar", label: "Pago pendiente de verificar",
    description: "Hay una solicitud de reserva esperando la verificación del pago. Las noches se apartan temporalmente; la reserva aún no está confirmada." },
  { key: "airbnb", color: "Rosa", label: "Ocupada según Airbnb",
    description: "El calendario de Airbnb indica que esta noche está reservada o bloqueada." },
  { key: "expedia", color: "Azul", label: "Ocupada según Expedia",
    description: "El calendario de Expedia indica que esta noche está reservada o bloqueada." },
] as const;

function ExampleNight({ colors, day = 15 }: { colors: string[]; day?: number }) {
  return <div aria-hidden="true" className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-3 rounded-xl bg-sand-100">
    <span className="text-sm font-medium">{day}</span>
    <span className="flex justify-center gap-1">{colors.map((color) =>
      <span key={color} className={cn("h-2 w-2 rounded-full", color)} />)}</span>
  </div>;
}

export function AdminCalendarLegend() {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const close = () => dialog.current?.close();

  return <div className="mt-4">
    <ul aria-label="Colores del calendario" className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted">
      {entries.map((entry) => <li key={entry.key} className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", calendarDotColors[entry.key])} />
        {entry.label}
      </li>)}
    </ul>
    <button type="button" aria-haspopup="dialog" aria-controls={id} onClick={() => dialog.current?.showModal()}
      className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-warm-white px-3 py-2 text-sm font-medium text-olive-800 hover:bg-sand-100">
      <CircleHelp size={16} aria-hidden="true" /> Ver colores y ejemplos
    </button>
    <dialog ref={dialog} id={id} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-border bg-warm-white p-5 text-ink shadow-xl backdrop:bg-black/40 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 id={`${id}-title`} className="font-serif text-2xl">¿Qué significan los colores?</h2>
        <button type="button" onClick={close} aria-label="Cerrar ayuda de colores"
          className="shrink-0 rounded-full p-2 hover:bg-sand-100"><X size={20} aria-hidden="true" /></button>
      </div>
      <p id={`${id}-description`} className="mt-3 text-sm text-muted">
        Mira los puntos debajo de cada fecha. Estos ejemplos muestran qué significa cada color en el domo seleccionado.
      </p>
      <ul className="mt-5 space-y-3">
        {entries.map((entry) => <li key={entry.key} className="flex items-start gap-4 rounded-xl border border-border p-3">
          <ExampleNight colors={[calendarDotColors[entry.key]]} />
          <div><h3 className="text-sm font-semibold">{entry.color} · {entry.label}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{entry.description}</p></div>
        </li>)}
      </ul>
      <div className="mt-4 flex items-start gap-4 rounded-xl bg-sand-50 p-3">
        <ExampleNight day={16} colors={[calendarDotColors.web, calendarDotColors.airbnb, calendarDotColors.expedia]} />
        <div><h3 className="text-sm font-semibold">Varios puntos en una misma noche</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">La misma noche puede aparecer en varios calendarios por la sincronización.
            No significa necesariamente que haya varias reservas. Pulsa la fecha para consultar sus detalles antes de liberar noches.</p></div>
      </div>
      <div className="mt-5 flex justify-end">
        <button type="button" onClick={close} className="rounded-xl bg-olive-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-olive-800">Entendido</button>
      </div>
    </dialog>
  </div>;
}
