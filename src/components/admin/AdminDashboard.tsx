"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, LogOut, RefreshCw } from "lucide-react";
import { addDays, nightsBetween, todayInCostaRica } from "@/lib/date-range";
import { cn } from "@/lib/cn";
import type { CalendarSource } from "@/lib/ical";
import { AdminCancellationDialog } from "@/components/admin/AdminCancellationDialog";
import { AdminDayDetailsPopover } from "@/components/admin/AdminDayDetailsPopover";
import { AdminPaymentLinkStatus } from "@/components/admin/AdminPaymentLinkStatus";
import { AdminNightPrice } from "@/components/admin/AdminNightPrice";
import type { NightlyPricing } from "@/lib/nightly-pricing";
import { adminReservationStatusLabels as statusLabels, isActiveAdminReservation,
  getAdminDayReservations, getAdminDaySources, type AdminReservation as Reservation } from "@/lib/admin-calendar-view";

type Calendar = { dome: string; pricing: NightlyPricing | null; bookingEnabled: boolean; reservations: Reservation[];
  imported: CalendarSource[]; issues: Reservation[]; checkedAt: string };

const active = (row: Reservation) => isActiveAdminReservation(row);
const overlaps = (start: string, end: string, day: string) => start <= day && day < end;
const field = "mt-2 w-full rounded-xl border border-border bg-warm-white px-3 py-2.5";
const actionClass = "rounded-xl border border-border bg-warm-white px-3 py-2 text-sm font-medium hover:bg-sand-100 disabled:opacity-50";

function moveMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

export function AdminDashboard({ domes, checkout, siteOrigin }: { domes: Array<{ slug: string; name: string; enabled: boolean }>;
  siteOrigin?: string | null;
  checkout: { enabled: boolean; freeTest: boolean; environment: string; missing: string[]; emailMissing: string[] } }) {
  const router = useRouter();
  const requestSequence = useRef(0);
  const [dome, setDome] = useState(domes[0]?.slug ?? "");
  const [month, setMonth] = useState(() => todayInCostaRica().slice(0, 7));
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [cancellation, setCancellation] = useState<Reservation | null>(null);
  const [dayDetails, setDayDetails] = useState<{ day: string; dome: string; anchor: HTMLButtonElement } | null>(null);
  const [priceMode, setPriceMode] = useState(false);
  const [priceStart, setPriceStart] = useState("");
  const [priceLast, setPriceLast] = useState("");
  const [priceAnchor, setPriceAnchor] = useState("");
  const [nightPrice, setNightPrice] = useState("");
  const closeDayDetails = useCallback(() => setDayDetails(null), []);
  const releaseDates = useCallback((row: Reservation) => {
    setDayDetails(null); setError(""); setMessage(""); setCancellation(row);
  }, []);
  const start = `${month}-01`;
  const end = `${moveMonth(month, 1)}-01`;
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);
  const leading = (new Date(`${start}T12:00:00Z`).getUTCDay() + 6) % 7;
  const selectedDome = domes.find((item) => item.slug === dome);
  const exportPath = `/api/calendar/${dome}/calendar.ics`;
  const exportUrl = siteOrigin ? new URL(exportPath, siteOrigin).href : exportPath;
  const canBlock = Boolean(selectedDome?.enabled && calendar?.imported.length &&
    calendar.imported.every((source) => source.status === "ready"));
  const priceMap = new Map(calendar?.pricing?.nights.map((night) => [night.date, night]));
  const money = (cents: number) => new Intl.NumberFormat("es-CR", { style: "currency", currency: calendar?.pricing?.currency ?? "USD" }).format(cents / 100);
  const selectedNights = priceStart && priceLast >= priceStart ? nightsBetween(priceStart, priceLast) + 1 : 0;
  const priceRangeReady = Boolean(calendar?.pricing && !loading && selectedNights > 0 && selectedNights <= 365 && priceStart >= todayInCostaRica());

  const refresh = useCallback(async (force = false, signal?: AbortSignal) => {
    if (!dome) return;
    const sequence = ++requestSequence.current;
    try {
      const query = new URLSearchParams({ dome, start, end, refresh: String(force) });
      const response = await fetch(`/api/admin/calendar?${query}`, { cache: "no-store", signal });
      if (response.status === 401) { router.replace("/admin/login"); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo consultar el calendario.");
      if (result.dome !== dome) throw new Error("El calendario recibido no corresponde al domo seleccionado.");
      if (!signal?.aborted && sequence === requestSequence.current) { setCalendar(result); setError(""); }
    } catch (reason) {
      if (!signal?.aborted && sequence === requestSequence.current) setError(reason instanceof Error ? reason.message : "Error de conexión.");
    } finally { if (!signal?.aborted && sequence === requestSequence.current) setLoading(false); }
  }, [dome, start, end, router]);

  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => refresh(false, controller.signal), 0);
    const visible = () => { if (!document.hidden) refresh(false, controller.signal); };
    document.addEventListener("visibilitychange", visible);
    return () => { controller.abort(); window.clearTimeout(initial); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);

  async function mutate(url: string, method: string, body?: object, success?: string) {
    if (busy) return false;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined });
      if (response.status === 401) { router.replace("/admin/login"); return false; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo completar la operación.");
      setMessage(success ?? result.warning ?? "Operación completada.");
      await refresh(url !== "/api/admin/prices" && (body as { action?: string } | undefined)?.action !== "retry-payment-link");
      return true;
    } catch (reason) {
      // A failed provider request may still have saved a useful safe diagnostic.
      // Refresh it without importing OTA feeds or discarding the error message.
      if ((body as { action?: string } | undefined)?.action === "retry-payment-link") await refresh(false);
      setError(reason instanceof Error ? reason.message : "Error de conexión."); return false;
    }
    finally { setBusy(false); }
  }

  async function block(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await mutate("/api/admin/blocks", "POST", { dome, checkIn, checkOut, note: fields.get("note") },
      "Bloqueo creado y publicado en nuestro iCal. Airbnb y Expedia lo importarán según sus propios tiempos.");
  }

  async function savePrice(restore = false) {
    if (!priceRangeReady) return;
    await mutate("/api/admin/prices", restore ? "DELETE" : "PUT", {
      dome, start: priceStart, end: addDays(priceLast, 1), price: nightPrice,
    }, `${restore ? "Precio base restablecido" : "Precio por noche actualizado"} para ${selectedDome?.name}: ${priceStart} al ${priceLast}, ambas noches incluidas. Las reservas existentes no cambian.`);
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/logout", { method: "POST" });
      if (!response.ok) throw new Error("No se pudo cerrar la sesión.");
      router.replace("/admin/login"); router.refresh();
    } catch { setError("No se pudo cerrar la sesión. Intenta de nuevo."); setBusy(false); }
  }

  const rows = calendar?.reservations ?? [];
  const inPeriod = selectedDay ? rows.filter((row) => overlaps(row.checkIn, row.checkOut, selectedDay)) : rows;
  const visible = showHistory ? inPeriod : inPeriod.filter(active);
  const historyCount = inPeriod.filter((row) => !active(row)).length;
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
    {(!checkout.freeTest && checkout.missing.length > 0) || checkout.emailMissing.length > 0 ? <section role="alert" className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
      {!checkout.freeTest && checkout.missing.length ? <p className="mt-2 text-amber-900">Falta configurar: {checkout.missing.join(", ")}. No se iniciarán pagos hasta completarlo.</p> : null}
      {checkout.emailMissing.length ? <p className="mt-2 text-amber-900">Correo pendiente de configurar: {checkout.emailMissing.join(", ")}. Esto no anula reservas pagadas; los envíos quedan pendientes para reintento.</p> : null}
    </section> : null}
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="eyebrow text-olive-700">Macas Moon · Panel privado</p>
        <h1 className="mt-2 font-serif text-3xl text-ink">Reservas y disponibilidad</h1></div>
      <button onClick={logout} disabled={busy} className={cn(actionClass, "inline-flex items-center gap-2")}>
        <LogOut size={16} /> Cerrar sesión</button>
    </header>
    {error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p> : null}
    {message ? <p role="status" className="mt-4 rounded-xl bg-olive-50 p-4 text-sm text-olive-900">{message}</p> : null}
    {calendar?.issues.length ? <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
      <h2 className="font-semibold text-red-900">Pagos que requieren atención</h2>
      {calendar.issues.map((row) => <p key={row.id} className="mt-2 text-sm text-red-800">
        {row.id} · {row.name} · {row.checkIn} → {row.checkOut}: {row.paymentIssue}</p>)}
    </section> : null}
    <div className="mt-6 flex flex-wrap items-end gap-4">
      <label className="text-sm font-medium">Ver calendario de<select value={dome} disabled={busy} onChange={(event) => {
        requestSequence.current++; setDome(event.target.value); setCalendar(null); setLoading(true);
        setSelectedDay(""); setDayDetails(null); setCheckIn(""); setCheckOut(""); setMessage(""); setError("");
        setPriceStart(""); setPriceLast(""); setPriceAnchor(""); setNightPrice("");
      }} className={field}>{domes.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <label className="text-sm font-medium">Mes<input type="month" value={month} disabled={busy} onChange={(event) => {
        if (event.target.value) { requestSequence.current++; setMonth(event.target.value); setCalendar(null); setLoading(true); setSelectedDay(""); setDayDetails(null); }
      }} className={field} /></label>
      <button disabled={loading || busy} onClick={() => { setLoading(true); refresh(true); }} className={cn(actionClass, "inline-flex items-center gap-2")}>
        <RefreshCw size={16} /> {loading ? "Consultando…" : "Actualizar desde Airbnb y Expedia"}</button>
    </div>
    <p className="mt-4 text-sm font-medium text-olive-800">Calendario y reservas de {selectedDome?.name}</p>
    {selectedDome && !selectedDome.enabled ? <p className="mt-2 text-sm text-muted">Las reservas en línea de este domo están desactivadas. Puedes consultar su historial; habilítalo en BOOKING_ACTIVE_DOMES cuando su configuración esté completa.</p> : null}
    <section className="mt-4 rounded-2xl border border-border bg-warm-white p-4 text-sm" aria-label="Enlace de sincronización iCal">
      <h2 className="font-semibold">Sincronización de {selectedDome?.name}</h2>
      <p className="mt-2 text-muted">Importa este enlace en los anuncios correspondientes de Airbnb y Expedia. Cambia el selector para obtener el enlace del otro domo.</p>
      <code className="mt-3 block break-all rounded-xl bg-sand-50 p-3 text-xs">{exportUrl}</code>
      {siteOrigin ? <button type="button" className={cn(actionClass, "mt-3")} onClick={async () => {
        try { await navigator.clipboard.writeText(exportUrl); setMessage("Enlace iCal copiado."); }
        catch { setError("No se pudo copiar el enlace. Selecciona y copia la dirección mostrada."); }
      }}>Copiar enlace iCal</button> : <p className="mt-2 text-xs text-muted">El enlace completo estará disponible en el sitio publicado.</p>}
      <p className="mt-2 text-xs text-muted">El enlace sigue disponible aunque desactives nuevas reservas de este domo. No necesita usuario ni contraseña y no incluye datos del huésped.</p>
    </section>
    {!domes.length ? <p className="mt-5">No hay domos habilitados. Revisa BOOKING_ACTIVE_DOMES.</p> : null}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {calendar?.imported.map((source) => <p key={source.name} className="rounded-xl border border-border bg-warm-white p-3 text-sm">
        <strong>{source.name}:</strong> {source.status === "ready" ? "Calendario leído" : source.status === "unconfigured" ? "Enlace no configurado" : "Error de lectura"}
        {source.checkedAt ? <span className="mt-1 block text-xs text-muted">Consulta: {new Date(source.checkedAt).toLocaleString("es-CR")}</span> : null}
      </p>)}
    </div>
    <div className="mt-5 grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
      <section aria-label="Calendario administrativo" className="min-w-0 rounded-2xl border border-border bg-warm-white p-4 sm:p-6">
        <div className="mb-4 flex gap-2" aria-label="Modo del calendario">
          <button type="button" aria-pressed={!priceMode} className={cn(actionClass, !priceMode && "bg-olive-100")} disabled={busy}
            onClick={() => { setPriceMode(false); setDayDetails(null); }}>Reservas y bloqueos</button>
          <button type="button" aria-pressed={priceMode} className={cn(actionClass, priceMode && "bg-olive-100")} disabled={busy}
            onClick={() => { setPriceMode(true); setDayDetails(null); }}>Editar precios</button>
        </div>
        <div className="mb-4 flex items-center justify-between">
          <button aria-label="Mes anterior" disabled={busy} className={actionClass} onClick={() => { requestSequence.current++; setMonth(moveMonth(month, -1)); setCalendar(null); setLoading(true); setSelectedDay(""); setDayDetails(null); }}><ChevronLeft size={18} /></button>
          <h2 className="font-semibold capitalize">{new Date(`${start}T12:00:00Z`).toLocaleDateString("es-CR", { month: "long", year: "numeric", timeZone: "UTC" })}</h2>
          <button aria-label="Mes siguiente" disabled={busy} className={actionClass} onClick={() => { requestSequence.current++; setMonth(moveMonth(month, 1)); setCalendar(null); setLoading(true); setSelectedDay(""); setDayDetails(null); }}><ChevronRight size={18} /></button>
        </div>
        <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[420px] grid-cols-7 gap-1 sm:min-w-0">
          {["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((label) => <span key={label} className="py-2 text-center text-xs text-muted">{label}</span>)}
          {Array.from({ length: leading }, (_, index) => <span key={`empty-${index}`} />)}
          {Array.from({ length: days }, (_, index) => {
            const day = `${month}-${String(index + 1).padStart(2, "0")}`;
            const local = getAdminDayReservations(rows, dome, day);
            const sources = getAdminDaySources(calendar?.imported ?? [], day);
            const occupied = local.length > 0 || sources.length > 0;
            const verified = calendar?.imported.every((source) => source.status === "ready");
            const selected = checkIn && checkOut ? checkIn <= day && day < checkOut : checkIn === day;
            const labels = [...local.map((row) => row.kind === "manual" ? "Bloqueo manual" : row.status === "pending" ? "Pago pendiente" : "Reserva web"), ...sources.map((source) => source.name)];
            return <button type="button" key={day} disabled={!calendar || busy} aria-label={`${day}: ${labels.join(", ") || (verified ? "Disponible" : "Sin verificar")}${priceMap.has(day) ? `, precio ${money(priceMap.get(day)!.amountCents)} por noche` : calendar ? ", precio no disponible" : ""}`}
              aria-pressed={priceMode ? Boolean(priceStart && day >= priceStart && day <= priceLast) : undefined}
              aria-haspopup={occupied && !priceMode ? "dialog" : undefined}
              aria-expanded={occupied && !priceMode ? dayDetails?.day === day && dayDetails.dome === dome : undefined}
              aria-controls={dayDetails?.day === day && dayDetails.dome === dome ? "admin-day-details" : undefined}
              onClick={(event) => {
                if (priceMode) {
                  if (day < todayInCostaRica()) return;
                  if (!priceAnchor) {
                    setPriceStart(day); setPriceLast(day); setPriceAnchor(day);
                    const price = priceMap.get(day)?.amountCents;
                    setNightPrice(price === undefined ? "" : (price / 100).toFixed(2));
                  } else {
                    setPriceStart(day < priceAnchor ? day : priceAnchor);
                    setPriceLast(day > priceAnchor ? day : priceAnchor); setPriceAnchor("");
                  }
                  return;
                }
                setSelectedDay(day);
                const anchor = event.currentTarget;
                setDayDetails((old) => occupied && !(old?.day === day && old.dome === dome)
                  ? { day, dome, anchor } : null);
                if (!occupied && day >= todayInCostaRica()) {
                  if (!checkIn || checkOut || day <= checkIn) { setCheckIn(day); setCheckOut(""); }
                  else setCheckOut(day);
                }
              }} className={cn("min-h-24 rounded-xl border border-transparent p-1 text-center align-top text-sm",
                occupied ? "bg-sand-100" : verified ? "bg-olive-50" : "bg-sand-50 text-muted",
                !priceMode && selected && "border-olive-600", !priceMode && selectedDay === day && "ring-2 ring-olive-600",
                priceMode && day >= priceStart && day <= priceLast && "ring-2 ring-olive-600 bg-olive-100")}>
              <span className="font-medium">{index + 1}</span>
              {calendar ? <AdminNightPrice day={day} night={priceMap.get(day)} currency={calendar.pricing?.currency ?? null} /> : null}
              <span className="mt-1 flex flex-wrap justify-center gap-1">
                {local.some((row) => row.kind === "manual") ? <span title="Manual" className="h-2 w-2 rounded-full bg-purple-500" /> : null}
                {local.some((row) => row.kind === "booking" && row.status === "confirmed") ? <span title="Reserva web" className="h-2 w-2 rounded-full bg-olive-700" /> : null}
                {local.some((row) => row.status === "pending") ? <span title="Pago pendiente" className="h-2 w-2 rounded-full bg-amber-500" /> : null}
                {sources.map((source) => <span key={source.name} title={source.name} className={cn("h-2 w-2 rounded-full", source.name === "Airbnb" ? "bg-rose-500" : "bg-blue-500")} />)}
              </span>
            </button>;
          })}
        </div>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 font-semibold text-teal-950">{calendar?.pricing?.currency ?? "USD"}/noche</span>
          <span>Turquesa: precio configurado por noche para esa fecha en esta web.</span>
        </p>
        <p className="mt-2 text-xs text-muted">Los precios del calendario no modifican los importes de reservas ya creadas.</p>
        <p className="mt-4 text-xs leading-relaxed text-muted">Verde: reserva web · Morado: bloqueo manual · Ámbar: pago pendiente · Rosa: Airbnb · Azul: Expedia.</p>
        <p className="mt-2 text-xs text-muted">{priceMode ? "Pulsa la primera y la última noche para cambiar el precio de todo el rango. Para una sola noche basta un clic." : "Pulsa una fecha ocupada para consultar sus detalles y liberar fechas de esta web."}</p>
        <p className="mt-2 text-xs text-muted">Una noche puede aparecer en varios feeds por la sincronización. Los puntos de colores indican qué calendario la exporta, no necesariamente dónde se originó.</p>
      </section>
      {priceMode ? <form onSubmit={(event) => { event.preventDefault(); savePrice(); }} className="space-y-4 rounded-2xl border border-border bg-warm-white p-5">
        <h2 className="font-serif text-xl">Precio de las noches</h2>
        <p className="text-sm font-medium text-olive-800">{selectedDome?.name}</p>
        <p className="text-sm text-muted">Precio base: {calendar?.pricing ? money(calendar.pricing.basePriceCents) : "sin configurar"} por noche. Tú eliges las tarifas; no hay ajustes automáticos.</p>
        <label className="block text-sm font-medium">Primera noche
          <input required type="date" min={todayInCostaRica()} value={priceStart} disabled={busy} onChange={(event) => {
            setPriceStart(event.target.value); setPriceAnchor(""); if (priceLast < event.target.value) setPriceLast(event.target.value);
          }} className={field} /></label>
        <label className="block text-sm font-medium">Última noche (incluida)
          <input required type="date" min={priceStart || todayInCostaRica()} value={priceLast} disabled={busy}
            onChange={(event) => { setPriceLast(event.target.value); setPriceAnchor(""); }} className={field} /></label>
        <label className="block text-sm font-medium">Precio por noche ({calendar?.pricing?.currency ?? "USD"})
          <input required type="text" inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" maxLength={10} placeholder="Por ejemplo: 200,00" value={nightPrice} disabled={busy}
            onChange={(event) => setNightPrice(event.target.value)} className={field} /></label>
        <p className="text-xs text-muted">El mismo precio se aplicará a todas las noches del rango, incluidas la primera y la última. Máximo 365 noches por operación.</p>
        {selectedNights > 0 ? <p role="status" className="text-sm font-medium">{selectedNights} {selectedNights === 1 ? "noche seleccionada" : "noches seleccionadas"}{selectedNights > 365 ? ": el rango supera el máximo de 365" : ""}.</p> : null}
        <button disabled={busy || !priceRangeReady || !nightPrice} className="w-full rounded-xl bg-olive-700 p-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Guardando…" : "Aplicar precio a las noches seleccionadas"}</button>
        <button type="button" disabled={busy || !priceRangeReady} className={cn(actionClass, "w-full")} onClick={() => savePrice(true)}>Restablecer precio base en este rango</button>
        <p className="text-xs text-muted">Solo cambia los precios de esta web. No modifica reservas ni enlaces de pago ya creados. Airbnb y Expedia mantienen sus propias tarifas: iCal sincroniza disponibilidad, no precios.</p>
      </form> : <form onSubmit={block} className="space-y-4 rounded-2xl border border-border bg-warm-white p-5">
        <h2 className="font-serif text-xl">Bloquear noches manualmente</h2>
        <p className="text-sm font-medium text-olive-800">{selectedDome?.name}</p>
        {!canBlock ? <p className="text-sm text-amber-900">Para crear bloqueos, este domo debe estar habilitado y sus calendarios de Airbnb y Expedia deben poder verificarse.</p> : null}
        <p className="text-xs leading-relaxed text-muted">El último día es la salida y no se bloquea. Para bloquear una noche, elige ese día y el siguiente. Máximo 365 noches.</p>
        <label className="block text-sm font-medium">Desde (primera noche)
          <input required type="date" min={todayInCostaRica()} value={checkIn} onChange={(event) => { setCheckIn(event.target.value); setCheckOut(""); }} className={field} /></label>
        <label className="block text-sm font-medium">Hasta (día de salida)
          <input required type="date" min={checkIn ? addDays(checkIn, 1) : todayInCostaRica()} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className={field} /></label>
        <label className="block text-sm font-medium">Motivo
          <input required name="note" maxLength={300} placeholder="Mantenimiento, uso de los dueños…" className={field} /></label>
        <button disabled={busy || loading || !canBlock || !dome || !checkIn || checkOut <= checkIn} className="w-full rounded-xl bg-olive-700 p-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Guardando…" : "Crear bloqueo"}</button>
      </form>}
    </div>
    <section className="mt-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-serif text-2xl">Reservas y bloqueos {selectedDay ? `del ${selectedDay}` : "del mes"}</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={showHistory} className={actionClass} onClick={() => setShowHistory((value) => !value)}>{showHistory ? "Mostrar solo activas" : `Mostrar historial${historyCount ? ` (${historyCount})` : ""}`}</button>
          {selectedDay ? <button className={actionClass} onClick={() => setSelectedDay("")}>Ver todo el mes</button> : null}
        </div></div>
      <p className="mt-2 text-sm text-muted">Los datos de huéspedes corresponden a reservas de esta web. iCal solo aporta noches ocupadas de los otros canales.</p>
      <div className="mt-4 space-y-3">
        {visible.map((row) => <article key={row.id} className="rounded-2xl border border-border bg-warm-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="font-semibold">{row.kind === "manual" ? "Bloqueo manual" : row.name} · {statusLabels[row.status]}</h3>
              <p className="mt-1 text-sm">{row.checkIn} → {row.checkOut} {row.provider === "test" ? "· Sin cobro" : ""}</p>
              {row.kind === "manual" ? <p className="mt-2 text-sm text-muted">Motivo: {row.note}</p> : <>
                <p className="mt-2 break-all text-sm text-muted">{row.email} · {row.phone} · País: {row.country} · {row.guests} huéspedes</p>
                <p className="mt-1 text-sm">{new Intl.NumberFormat("es-CR", { style: "currency", currency: row.currency }).format(row.amountCents / 100)}
                  {row.provider === "test" ? " (importe de referencia, sin cobro)" : row.paymentEnvironment !== "Production" ? " · Sin cargo real" : row.status === "confirmed" ? " · Pago verificado" : " · Importe de la reserva"}
                  {row.status === "confirmed" ? row.emailSent ? " · Correo al huésped enviado" : " · Correo al huésped pendiente" : ""}</p>
                {row.status === "confirmed" && row.ownerEmailRequired ? <p className="mt-1 text-sm text-muted">
                  Aviso a los dueños: {row.ownerEmailSent ? "enviado" : "pendiente"}</p> : null}
              </>}
              {row.status === "expired" ? <p className="mt-3 text-sm text-muted">El plazo de 30 minutos terminó sin confirmación en esta web. Esta solicitud no bloquea noches ni se exporta por iCal. El estado no acredita ni descarta un cobro: si hubo aprobación, revisa Tilopay.</p> : null}
              {row.status === "cancelled" && row.cancellationReason ? <p className="mt-3 text-sm text-muted">
                Anulación: {row.cancellationReason} · {row.cancelledBy}
                {row.cancelledAt ? ` · ${new Date(row.cancelledAt).toLocaleString("es-CR", { timeZone: "America/Costa_Rica" })}` : ""}
                {row.cancellationStart && row.cancellationEnd ? ` · Noches liberadas: ${row.cancellationStart} → ${row.cancellationEnd}` : ""}
              </p> : null}
              {row.parentBlockId ? <p className="mt-2 text-xs text-muted">Tramo conservado del bloqueo {row.parentBlockId}.</p> : null}
              <AdminPaymentLinkStatus row={row} environment={checkout.environment} />
              <p className="mt-2 break-all text-xs text-muted">ID: {row.id}</p></div>
            <div className="flex flex-wrap gap-2">
              {row.paymentLinkPending && row.paymentEnvironment === checkout.environment ? <button className={actionClass} disabled={busy} onClick={() => mutate(`/api/admin/reservations/${row.id}`, "POST", { action: "retry-payment-link", dome: row.dome })}>Revisar enlace de pago</button> : null}
              {row.status !== "cancelled" && (row.kind === "booking" || row.status === "confirmed") ? <button className={actionClass} disabled={busy} onClick={() => releaseDates(row)}>Liberar fechas</button> : null}
              {row.provider === "tilopay" && row.paymentEnvironment === checkout.environment && row.status !== "confirmed" && !(row.status === "cancelled" && row.cancelledFrom === "confirmed") ? <button className={actionClass} disabled={busy} onClick={() => mutate(`/api/admin/reservations/${row.id}`, "POST", { action: "reconcile" })}>Verificar pago</button> : null}
              {row.kind === "booking" && row.status === "confirmed" && (!row.emailSent || (row.ownerEmailRequired && !row.ownerEmailSent)) ? <button className={actionClass} disabled={busy} onClick={() => mutate(`/api/admin/reservations/${row.id}`, "POST", { action: "retry-email" })}>Reintentar correos pendientes</button> : null}
            </div>
          </div>
        </article>)}
        {!visible.length && !loading ? <p className="rounded-xl bg-warm-white p-4 text-sm text-muted">{showHistory ? "No hay reservas ni bloqueos locales en este período." : "No hay reservas ni bloqueos locales activos en este período. Puedes consultar los anteriores con Mostrar historial."} Los bloqueos importados se muestran en el calendario superior.</p> : null}
      </div>
    </section>
    {dayDetails && calendar?.dome === dome && dayDetails.dome === dome && dayDetails.day.startsWith(month + "-") ?
      <AdminDayDetailsPopover anchor={dayDetails.anchor} day={dayDetails.day} dome={dome}
        domeName={selectedDome?.name ?? dome} reservations={rows} sources={calendar.imported}
        environment={checkout.environment} busy={busy} onClose={closeDayDetails} onRelease={releaseDates} /> : null}
    {cancellation ? <AdminCancellationDialog key={cancellation.id} target={cancellation}
      domeName={domes.find((item) => item.slug === cancellation.dome)?.name ?? cancellation.dome}
      busy={busy} error={error} onClose={() => { if (!busy) setCancellation(null); }}
      onConfirm={async (input) => {
        const success = await mutate(`/api/admin/reservations/${cancellation.id}`, "POST", input);
        if (success) setCancellation(null);
      }} /> : null}
  </div>;
}
