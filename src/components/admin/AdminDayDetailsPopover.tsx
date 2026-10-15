"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { CalendarSource } from "@/lib/ical";
import type { AdminReservation } from "@/lib/admin-calendar-view";
import { adminReservationStatusLabels, getAdminDayReservations, getAdminDaySources } from "@/lib/admin-calendar-view";
import { nightsBetween } from "@/lib/date-range";

function countryName(code: string) {
  try { return new Intl.DisplayNames(["es"], { type: "region" }).of(code) ?? code; }
  catch { return code || "No indicado"; }
}

export function AdminDayDetailsPopover({ anchor, day, dome, domeName, reservations, sources, environment, busy,
  onClose, onRelease }: {
  anchor: HTMLButtonElement; day: string; dome: string; domeName: string;
  reservations: AdminReservation[]; sources: CalendarSource[]; environment: string; busy: boolean;
  onClose: () => void; onRelease: (row: AdminReservation) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const focusedAnchor = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const local = getAdminDayReservations(reservations, dome, day);
  const imported = getAdminDaySources(sources, day);
  useLayoutEffect(() => {
    const element = panel.current;
    if (!element) return;
    const place = () => {
      if (!anchor.isConnected) { onClose(); return; }
      const rect = anchor.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) { onClose(); return; }
      const box = element.getBoundingClientRect();
      const margin = 12;
      const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - box.width / 2, window.innerWidth - box.width - margin));
      const below = rect.bottom + 8;
      const preferredTop = below + box.height <= window.innerHeight - margin ? below : rect.top - box.height - 8;
      const top = Math.max(margin, Math.min(preferredTop, window.innerHeight - box.height - margin));
      setPosition((old) => old?.left === left && old?.top === top ? old : { left, top });
    };
    const outside = (event: Event) => {
      if (event.target instanceof Node && !element.contains(event.target) && !anchor.contains(event.target)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); anchor.focus({ preventScroll: true }); }
    };
    place();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    observer?.observe(element);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [anchor, day, onClose]);

  useLayoutEffect(() => {
    if (position && focusedAnchor.current !== anchor) {
      closeButton.current?.focus({ preventScroll: true });
      focusedAnchor.current = anchor;
    }
  }, [anchor, position]);

  return <div ref={panel} id="admin-day-details" role="dialog" aria-labelledby="admin-day-details-title"
    className="fixed z-[60] max-h-[70vh] w-[calc(100%_-_1.5rem)] max-w-sm overflow-y-auto rounded-2xl border border-border bg-warm-white p-5 text-ink shadow-xl"
    style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}>
    <div className="flex items-start justify-between gap-3">
      <div><h2 id="admin-day-details-title" className="font-serif text-xl">{new Date(`${day}T12:00:00Z`).toLocaleDateString("es-CR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
      })}</h2><p className="mt-1 text-sm font-medium text-olive-800">{domeName}</p></div>
      <button ref={closeButton} type="button" aria-label="Cerrar detalles de la fecha" onClick={() => {
        onClose(); anchor.focus({ preventScroll: true });
      }} className="rounded-full p-2 hover:bg-sand-100"><X size={18} aria-hidden="true" /></button>
    </div>
    <div className="mt-4 space-y-4">
      {local.map((row) => <article key={row.id} className="rounded-xl border border-border p-3 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="font-semibold">{row.kind === "manual" ? "Bloqueo manual" : row.name}</h3>
          <span className="rounded-full bg-sand-50 px-2 py-1 text-xs">{row.status === "pending" ? "Pago pendiente" : adminReservationStatusLabels[row.status]}</span>
        </div>
        <p className="mt-2">{row.checkIn} → {row.checkOut} · {nightsBetween(row.checkIn, row.checkOut)} noches</p>
        {row.kind === "manual" ? <p className="mt-2 break-words text-muted">Motivo: {row.note}</p> : <dl className="mt-3 space-y-2">
          <div><dt className="text-xs text-muted">Contacto</dt><dd className="break-all"><a href={`mailto:${encodeURIComponent(row.email)}`} className="underline">{row.email}</a></dd>
            <dd className="mt-1">{row.phone.replace(/[^\d+]/g, "") ? <a href={`tel:${row.phone.replace(/[^\d+]/g, "")}`} className="underline">{row.phone}</a> : row.phone || "Teléfono no indicado"}</dd></div>
          <div><dt className="text-xs text-muted">Huéspedes y residencia</dt><dd>{row.guests} huéspedes · {countryName(row.country)}</dd></div>
          <div><dt className="text-xs text-muted">Importe de la reserva</dt><dd>{new Intl.NumberFormat("es-CR", {
            style: "currency", currency: row.currency,
          }).format(row.amountCents / 100)} · {row.provider === "test" ? "Sin cobro" : environment === "Test" ? "Sin cargo real"
            : row.status === "confirmed" ? "Pago verificado" : "Pago pendiente"}</dd></div>
        </dl>}
        {row.paymentIssue ? <p className="mt-3 text-sm text-red-800">Requiere atención: {row.paymentIssue}</p> : null}
        <p className="mt-3 break-all text-xs text-muted">ID: {row.id}</p>
        <button type="button" disabled={busy} onClick={() => onRelease(row)}
          className="mt-3 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-sand-100 disabled:opacity-50">Liberar fechas</button>
      </article>)}
      {imported.length ? <div className="rounded-xl bg-sand-50 p-3 text-sm">
        <p className="font-medium">{local.length ? "También figura como ocupada en:" : "Fecha ocupada según:"} {imported.map((source) => source.name).join(" y ")}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted">iCal no proporciona los datos de huéspedes de esas plataformas. Sus reservas y cierres se gestionan allí; no se pueden liberar desde esta web.</p>
      </div> : null}
      {!local.length && !imported.length ? <p className="text-sm text-muted">Ya no hay reservas ni bloqueos activos para esta noche. Consulta el calendario actualizado.</p> : null}
    </div>
  </div>;
}
