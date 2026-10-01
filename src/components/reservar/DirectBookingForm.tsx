"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { AvailabilityCalendar } from "@/components/reservar/AvailabilityCalendar";
import { Button } from "@/components/ui/Button";
import { domes } from "@/data/domes";
import type { AvailabilityResponse } from "@/lib/availability-types";
import { overlapsBlocked } from "@/lib/availability-types";
import { addDays, todayInCostaRica } from "@/lib/date-range";
import { useLanguage } from "@/i18n/LanguageProvider";

type Pricing = { currency: string; perNight: Record<string, number> };

function nights(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export function DirectBookingForm({ initialDome }: { initialDome?: string }) {
  const router = useRouter();
  const { t } = useLanguage();
  const testMode = process.env.NEXT_PUBLIC_BOOKING_TEST_MODE === "true";
  const validDome = domes.some((item) => item.slug === initialDome);
  const [dome, setDome] = useState(validDome ? initialDome! : "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [testSecret, setTestSecret] = useState("");

  useEffect(() => {
    fetch("/api/pricing", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
      .then((value) => setPricing(value)).catch(() => setPricing(null));
  }, []);

  const activeDome = (pricing?.perNight[dome] ?? 0) > 0
    ? dome
    : (domes.find((item) => (pricing?.perNight[item.slug] ?? 0) > 0)?.slug ?? "");

  useEffect(() => {
    if (!activeDome) return;
    let live = true;
    async function refresh() {
      try {
        const response = await fetch(`/api/availability/${activeDome}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Availability failed");
        const value = await response.json() as AvailabilityResponse;
        if (live) setAvailability(value);
      } catch {
        if (live) setAvailability({ status: "error", blocked: [], checkedAt: null });
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => { live = false; window.clearInterval(timer); };
  }, [activeDome]);

  const selected = domes.find((item) => item.slug === activeDome);
  const bookableDomes = domes.filter((item) => (pricing?.perNight[item.slug] ?? 0) > 0);
  const amountCents = checkIn && checkOut && pricing && activeDome
    ? Math.max(0, nights(checkIn, checkOut)) * (pricing.perNight[activeDome] ?? 0) : 0;
  const amount = pricing && amountCents > 0
    ? new Intl.NumberFormat("es-CR", { style: "currency", currency: pricing.currency }).format(amountCents / 100)
    : null;
  const [tomorrow] = useState(() => addDays(todayInCostaRica(), 1));
  const field = "mt-2 w-full rounded-2xl border border-border bg-warm-white px-4 py-3 text-ink outline-none focus:border-olive-500";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (availability?.status !== "ready" || !checkIn || !checkOut ||
      checkOut <= checkIn || overlapsBlocked(checkIn, checkOut, availability.blocked)) {
      setError("Las fechas no están disponibles o no pudieron verificarse.");
      return;
    }
    if (!pricing || !amountCents) { setError("No se pudo calcular el precio."); return; }
    if (testMode && !testSecret) { setError("Introduce la clave de prueba."); return; }
    const form = new FormData(event.currentTarget);
    const payload = {
      dome: activeDome, checkIn, checkOut, expectedAmountCents: amountCents,
      turnstileToken: form.get("cf-turnstile-response"),
      guests: Number(form.get("guests")),
      name: form.get("name"), email: form.get("email"), phone: form.get("phone"),
      address: form.get("address"), city: form.get("city"), state: form.get("state"),
      postalCode: form.get("postalCode"), country: form.get("country"),
    };
    setBusy(true);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST", headers: { "Content-Type": "application/json",
          ...(testMode && testSecret
            ? { "x-booking-test-secret": testSecret } : {}) },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar la reserva.");
      if (result.status === "confirmed") router.push(`/reservar/estado?id=${result.id}`);
      else if (result.paymentUrl) window.location.assign(result.paymentUrl);
      else throw new Error("Tilopay no devolvió una página de pago.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar la reserva.");
      (window as Window & { turnstile?: { reset: () => void } }).turnstile?.reset();
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-6">
    <label className="block text-sm font-medium text-ink">{t("Domo seleccionado")}
      <select required value={activeDome} onChange={(event) => {
        setDome(event.target.value); setCheckIn(""); setCheckOut(""); setAvailability(null);
      }} className={field}>
        <option value="">{t("Elige un domo")}</option>
        {bookableDomes.map((item) => <option key={item.slug} value={item.slug}>{t(item.name)}</option>)}
      </select>
    </label>
    {activeDome ? <AvailabilityCalendar availability={availability} checkIn={checkIn} checkOut={checkOut}
      onSelect={(arrival, departure) => { setCheckIn(arrival); setCheckOut(departure); setError(""); }} /> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-ink">{t("Fecha de llegada")}
        <input required type="date" min={tomorrow} value={checkIn} onChange={(event) => {
          setCheckIn(event.target.value); setCheckOut("");
        }} className={field} /></label>
      <label className="text-sm font-medium text-ink">{t("Fecha de salida")}
        <input required type="date" min={checkIn || tomorrow} value={checkOut}
          onChange={(event) => setCheckOut(event.target.value)} className={field} /></label>
    </div>
    <label className="block text-sm font-medium text-ink">{t("Huéspedes")}
      <input required type="number" name="guests" min="1" max={selected?.capacity ?? 1} defaultValue="2" className={field} /></label>
    <label className="block text-sm font-medium text-ink">{t("Nombre completo")}
      <input required name="name" autoComplete="name" maxLength={100} className={field} /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-ink">{t("Correo electrónico")}
        <input required type="email" name="email" autoComplete="email" maxLength={254} className={field} /></label>
      <label className="text-sm font-medium text-ink">{t("Teléfono")}
        <input required type="tel" name="phone" autoComplete="tel" maxLength={25} className={field} /></label>
    </div>
    <p className="text-sm text-muted">{testMode
      ? "Datos de la persona que realiza la reserva de prueba (no se hará ningún cobro):"
      : "Datos de facturación requeridos por la pasarela de pago:"}</p>
    <label className="block text-sm font-medium text-ink">Dirección
      <input required name="address" autoComplete="street-address" maxLength={150} className={field} /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-ink">Ciudad
        <input required name="city" autoComplete="address-level2" maxLength={80} className={field} /></label>
      <label className="text-sm font-medium text-ink">Provincia / estado
        <input required name="state" autoComplete="address-level1" maxLength={50} className={field} /></label>
      <label className="text-sm font-medium text-ink">Código postal
        <input required name="postalCode" autoComplete="postal-code" maxLength={20} className={field} /></label>
      <label className="text-sm font-medium text-ink">País (código de dos letras)
        <input required name="country" autoComplete="country" defaultValue="CR" maxLength={2} className={field} /></label>
    </div>
    {amount ? <p className="rounded-2xl bg-sand-50 p-4 text-sm text-ink">
      {nights(checkIn, checkOut)} noches · {testMode ? "Tarifa de referencia (no se cobra):" : "Total a pagar:"} <strong>{amount}</strong>
    </p> : <p className="text-sm text-muted">Selecciona las fechas para ver el precio final.</p>}
    <p className="text-xs leading-relaxed text-muted">{testMode
      ? "La reserva de prueba se confirma sin pago y aparece en el iCal de salida. Airbnb y Expedia consultan ese calendario periódicamente, por lo que persiste un riesgo de cruce de reservas."
      : "La reserva se confirma únicamente tras verificar el pago. Las plataformas externas actualizan sus calendarios iCal periódicamente, por lo que existe un riesgo residual de cruce de reservas."}</p>
    {testMode ? <label className="block text-sm font-medium text-ink">
      Clave de prueba (sin cobro)
      <input type="password" autoComplete="off" value={testSecret} onChange={(event) => setTestSecret(event.target.value)} className={field} />
    </label> : null}
    {!testMode && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        data-action="booking" />
    </> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    <Button type="submit" size="lg" className="w-full" disabled={busy || !amount || availability?.status !== "ready" || (testMode && !testSecret)}>
      {busy ? "Procesando…" : testMode ? "Confirmar reserva de prueba (sin cobro)" : "Continuar al pago seguro"}
    </Button>
  </form>;
}
