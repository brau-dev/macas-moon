"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AvailabilityResponse } from "@/lib/availability-types";
import { overlapsBlocked } from "@/lib/availability-types";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/cn";

function iso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nextDay(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

type Props = {
  availability: AvailabilityResponse | null;
  checkIn: string;
  checkOut: string;
  onSelect: (checkIn: string, checkOut: string) => void;
};

export function AvailabilityCalendar({ availability, checkIn, checkOut, onSelect }: Props) {
  const { t, language } = useLanguage();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const leading = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const now = new Date();
  const today = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const locale = language === "es" ? "es-CR" : language;
  const ready = availability?.status === "ready";
  const blocked = availability?.blocked ?? [];
  const labels = Array.from({ length: 7 }, (_, index) =>
    new Date(Date.UTC(2024, 0, index + 1)).toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }),
  );

  function choose(day: string) {
    if (!ready) return;
    if (!checkIn || checkOut || day <= checkIn) { onSelect(day, ""); return; }
    if (overlapsBlocked(checkIn, day, blocked)) { onSelect(day, ""); return; }
    onSelect(checkIn, day);
  }

  return <div className="rounded-2xl border border-border bg-sand-50 p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <button type="button" aria-label={t("Mes anterior")}
        disabled={year === now.getFullYear() && monthIndex === now.getMonth()}
        onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
        className="rounded-full p-2 text-olive-800 disabled:opacity-30">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <strong className="text-sm capitalize text-ink">{month.toLocaleDateString(locale, { month: "long", year: "numeric" })}</strong>
      <button type="button" aria-label={t("Mes siguiente")}
        onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
        className="rounded-full p-2 text-olive-800"><ChevronRight className="h-5 w-5" aria-hidden="true" /></button>
    </div>
    <div className="grid grid-cols-7 gap-1 text-center">
      {labels.map((label, index) => <span key={index} className="text-xs text-muted">{label}</span>)}
      {Array.from({ length: leading }, (_, index) => <span key={`empty-${index}`} />)}
      {Array.from({ length: days }, (_, index) => {
        const date = iso(year, monthIndex, index + 1);
        const occupied = overlapsBlocked(date, nextDay(date), blocked);
        const past = date <= today;
        const checkoutAllowed = Boolean(checkIn && !checkOut && date > checkIn &&
          !overlapsBlocked(checkIn, date, blocked));
        const selected = date === checkIn || date === checkOut;
        const inRange = Boolean(checkIn && checkOut && date > checkIn && date < checkOut);
        return <button key={date} type="button" disabled={past || (occupied && !checkoutAllowed) || !ready}
          onClick={() => choose(date)} aria-label={`${date}: ${occupied ? t("Ocupado") : ready ? t("Disponible") : t("Sin verificar")}`}
          aria-pressed={selected} className={cn("h-10 rounded-full text-sm transition-colors",
            occupied && "bg-sand-200 text-muted line-through", past && "text-sand-400",
            !past && !occupied && ready && "text-ink hover:bg-olive-100", inRange && "bg-olive-50",
            selected && "bg-olive-700 text-white", !ready && "cursor-not-allowed")}>{index + 1}</button>;
      })}
    </div>
    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      <span>{t("Disponible")}</span><span>● {t("Ocupado")}</span><span>{t("Seleccionado")}</span>
    </div>
    <p className="mt-3 text-xs leading-relaxed text-muted" role="status">
      {!availability ? "Consultando disponibilidad…" : ready
        ? "Fechas consultadas en Airbnb, Expedia y reservas directas. Se verifican de nuevo antes del pago."
        : "No se pudo verificar toda la disponibilidad. Las reservas están deshabilitadas temporalmente."}
    </p>
  </div>;
}
