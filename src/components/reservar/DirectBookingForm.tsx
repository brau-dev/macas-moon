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
import { residenceCountries } from "@/lib/countries";
import { trustedTilopayPaymentUrl } from "@/lib/tilopay-payment-url";
import { resolveBookingDome } from "@/lib/booking-selection";
import { useNightlyPricing } from "@/components/reservar/useNightlyPricing";

type Pricing = { currency: string; perNight: Record<string, number> };

function nights(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

export function DirectBookingForm({ initialDome }: { initialDome?: string }) {
  const router = useRouter();
  const { t, language } = useLanguage();
  const countryNames = new Intl.DisplayNames([language], { type: "region" });
  const countries = residenceCountries.map((code) => ({ code, name: countryNames.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, language));
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
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [guests, setGuests] = useState(2);
  const [month, setMonth] = useState(() => todayInCostaRica().slice(0, 7));

  useEffect(() => {
    fetch("/api/pricing", { cache: "no-store" }).then((response) => response.ok ? response.json() : null)
      .then((value) => setPricing(value)).catch(() => setPricing(null));
  }, []);

  const activeDome = resolveBookingDome(dome, pricing?.perNight);
  const quote = useNightlyPricing(activeDome, checkIn, checkOut, refreshVersion);

  useEffect(() => {
    if (!activeDome) return;
    let live = true;
    let inFlight = false;
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const response = await fetch(`/api/availability/${activeDome}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Availability failed");
        const value = await response.json() as AvailabilityResponse;
        if (live) setAvailability(value);
      } catch {
        if (live) setAvailability({ status: "error", blocked: [], checkedAt: null });
      } finally { inFlight = false; }
    }
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => { live = false; controller.abort(); document.removeEventListener("visibilitychange", refresh); };
  }, [activeDome, refreshVersion]);

  const selected = domes.find((item) => item.slug === activeDome);
  const amountCents = quote.pricing?.amountCents ?? 0;
  const amount = quote.pricing && amountCents > 0
    ? new Intl.NumberFormat("es-CR", { style: "currency", currency: quote.pricing.currency }).format(amountCents / 100)
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
    if (!quote.pricing || !amountCents) { setError("No se pudo consultar el precio. Actualiza e intenta de nuevo."); return; }
    if (testMode && !testSecret) { setError("Introduce la clave de acceso para reservas sin cobro."); return; }
    const form = new FormData(event.currentTarget);
    const payload = {
      dome: activeDome, checkIn, checkOut, expectedAmountCents: amountCents,
      turnstileToken: form.get("cf-turnstile-response"),
      guests: Number(form.get("guests")),
      name: form.get("name"), email: form.get("email"), phone: form.get("phone"),
      country: form.get("country"),
    };
    if (!testMode && (typeof payload.turnstileToken !== "string" || !payload.turnstileToken)) {
      setError("Espera a que termine la verificación de seguridad antes de continuar.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/reservations", {
        method: "POST", headers: { "Content-Type": "application/json",
          ...(testMode && testSecret
            ? { "x-booking-test-secret": testSecret } : {}) },
        body: JSON.stringify(payload),
      });
      let result;
      try { result = await response.json(); }
      catch { throw new Error("El servidor no pudo preparar el pago. Intenta de nuevo en unos momentos."); }
      if (!response.ok) {
        if (response.status === 409) setRefreshVersion((value) => value + 1);
        const reference = typeof result.requestId === "string" && /^[a-f0-9-]{36}$/.test(result.requestId)
          ? ` Referencia de soporte: ${result.requestId}.` : "";
        throw new Error((result.error ?? "No se pudo iniciar la reserva.") + reference);
      }
      if (result.status === "confirmed") router.push(`/reservar/estado?id=${result.id}`);
      else {
        const paymentUrl = trustedTilopayPaymentUrl(result.paymentUrl);
        if (!paymentUrl) throw new Error("No se recibió una dirección de pago válida de Tilopay.");
        window.location.assign(paymentUrl);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo iniciar la reserva.");
      (window as Window & { turnstile?: { reset: () => void } }).turnstile?.reset();
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="space-y-6">
    <label className="block text-sm font-medium text-ink">{t("Domo seleccionado")}
      <select required value={dome || activeDome} disabled={busy} onChange={(event) => {
        setDome(event.target.value); setCheckIn(""); setCheckOut(""); setAvailability(null); setError("");
        const capacity = domes.find((item) => item.slug === event.target.value)?.capacity ?? 1;
        setGuests((count) => Math.min(Math.max(count, 1), capacity));
      }} className={field}>
        <option value="">{t("Elige un domo")}</option>
        {domes.map((item) => <option key={item.slug} value={item.slug} disabled={!((pricing?.perNight[item.slug] ?? 0) > 0)}>{t(item.name)}</option>)}
      </select>
    </label>
    {dome && pricing && !activeDome ? <p role="status" className="text-sm text-muted">Las reservas en línea del domo seleccionado no están disponibles actualmente. Puedes elegir otro alojamiento en el selector.</p> : null}
    {activeDome ? <AvailabilityCalendar availability={availability} checkIn={checkIn} checkOut={checkOut}
      month={month} onMonthChange={setMonth}
      onSelect={(arrival, departure) => { setCheckIn(arrival); setCheckOut(departure); setError(""); }} /> : null}
    {activeDome ? <button type="button" disabled={busy} onClick={() => setRefreshVersion((value) => value + 1)}
      className="text-sm font-medium text-olive-800 underline disabled:opacity-50">Actualizar disponibilidad</button> : null}
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
      <input required type="number" name="guests" min="1" max={selected?.capacity ?? 1}
        value={guests || ""} onChange={(event) => setGuests(Number(event.target.value))} className={field} /></label>
    <label className="block text-sm font-medium text-ink">{t("Nombre completo")}
      <input required name="name" autoComplete="name" maxLength={100} className={field} /></label>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium text-ink">{t("Correo electrónico")}
        <input required type="email" name="email" autoComplete="email" maxLength={254} className={field} /></label>
      <label className="text-sm font-medium text-ink">{t("Teléfono")}
        <input required type="tel" name="phone" autoComplete="tel" maxLength={25} className={field} /></label>
    </div>
    <label className="block text-sm font-medium text-ink">{t("País de residencia")}
      <select required name="country" autoComplete="country" defaultValue="" className={field}>
        <option value="">{t("Selecciona tu país")}</option>
        {countries.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
      </select>
    </label>
    {quote.error ? <p role="alert" className="text-sm text-red-700">{quote.error}</p> : null}
    {amount ? <div className="rounded-2xl bg-sand-50 p-4 text-sm text-ink">
      <details className="mb-3"><summary className="cursor-pointer">Ver precio de cada noche</summary>
        <ul className="mt-2 space-y-1">{quote.pricing?.nights.map((night) => <li key={night.date} className="flex justify-between gap-3">
          <span>{night.date}</span><span>{new Intl.NumberFormat("es-CR", { style: "currency", currency: quote.pricing!.currency }).format(night.amountCents / 100)}</span>
        </li>)}</ul>
      </details>
      {nights(checkIn, checkOut)} noches · {testMode ? "Importe de referencia, sin cobro:" : "Total de la estadía:"} <strong>{amount}</strong>
    </div> : <p className="text-sm text-muted">{checkIn && checkOut && checkOut > checkIn ? "Consultando el precio de las noches…" : "Selecciona las fechas para ver el precio final."}</p>}
    <p className="text-xs leading-relaxed text-muted">{testMode
      ? "Esta modalidad permite confirmar una reserva sin cobro con una clave de acceso. Las noches confirmadas se publican en el calendario de disponibilidad."
      : "La reserva se confirma únicamente tras verificar el pago."}</p>
    {testMode ? <label className="block text-sm font-medium text-ink">
      Clave de acceso para reservas sin cobro
      <input type="password" autoComplete="off" value={testSecret} onChange={(event) => setTestSecret(event.target.value)} className={field} />
    </label> : null}
    {!testMode && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        data-action="booking" />
    </> : null}
    {!testMode ? <p className="text-xs text-muted">Al continuar se abrirá la página segura de Tilopay en esta misma pestaña. No introduzcas los datos de tu tarjeta en este formulario.</p> : null}
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
    {!testMode ? <p className="rounded-2xl bg-sand-50 p-4 text-sm leading-relaxed text-ink">
      {t("Si el pago no se completa o cancelas el proceso, las fechas pueden quedar apartadas temporalmente. Espera entre 15 y 20 minutos desde que iniciaste la solicitud y pulsa «Actualizar disponibilidad» antes de intentarlo de nuevo. Si el pago fue aprobado, no lo repitas.")}
    </p> : null}
    <Button type="submit" size="lg" className="w-full" disabled={busy || !amount || availability?.status !== "ready" || (testMode && !testSecret)}>
      {busy ? "Procesando…" : testMode ? "Confirmar reserva sin cobro" : "Continuar al pago"}
    </Button>
  </form>;
}
