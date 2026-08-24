"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { domes } from "@/data/domes";
import { submitReservationRequest } from "@/lib/reservations";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/cn";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import dePhoneLabels from "react-phone-number-input/locale/de";
import enPhoneLabels from "react-phone-number-input/locale/en";
import esPhoneLabels from "react-phone-number-input/locale/es";
import frPhoneLabels from "react-phone-number-input/locale/fr";
import "react-phone-number-input/style.css";

const FIELD_LIMITS = {
  name: 100,
  email: 254,
  phone: 25,
  message: 600,
} as const;

type ReservationFormProps = {
  initialDome?: string;
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return formatDateInput(date);
}

function isoToDisplay(iso: string) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function monthFromIso(iso: string) {
  const [year, month] = iso.split("-").map(Number);
  return { year, month: month - 1 };
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function weekdayLabels(locale: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2024, 0, 1 + index));
    return date.toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" }).replace(".", "");
  });
}

function DateField({
  label,
  value,
  min,
  name,
  fieldClass,
  required,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  name: string;
  fieldClass: string;
  required?: boolean;
  onChange: (iso: string) => void;
}) {
  const { t, language } = useLanguage();
  const locale = language === "es" ? "es-CR" : language;
  const rootRef = useRef<HTMLDivElement>(null);
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const [usesNativePicker, setUsesNativePicker] = useState(true);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => monthFromIso(value || min));

  useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const iOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    // Detect input mode after hydration so SSR markup stays stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsesNativePicker(coarse || iOS);
  }, []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function applyIso(iso: string) {
    if (!iso) return;
    onChange(iso < min ? min : iso);
  }

  if (usesNativePicker) {
    return (
      <label className="block">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className={cn("relative block", fieldClass)}>
          <input
            required={required}
            type="date"
            name={name}
            autoComplete="off"
            lang={locale}
            min={min}
            value={value}
            onChange={(event) => applyIso(event.target.value)}
            className="date-native-input w-full appearance-none border-0 bg-transparent p-0 text-ink shadow-none outline-none"
          />
        </span>
      </label>
    );
  }

  const minMonth = monthFromIso(min);
  const canGoPrev =
    view.year > minMonth.year || (view.year === minMonth.year && view.month > minMonth.month);
  const daysInView = new Date(view.year, view.month + 1, 0).getDate();
  const leadingEmpty = (() => {
    const weekday = new Date(view.year, view.month, 1).getDay();
    return weekday === 0 ? 6 : weekday - 1;
  })();
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });

  function selectDay(day: number) {
    const iso = formatDateInput(new Date(view.year, view.month, day));
    if (iso < min) return;
    applyIso(iso);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <span id={labelId} className="text-sm font-medium text-ink">
        {label}
      </span>
      <button
        type="button"
        id={fieldId}
        aria-labelledby={labelId}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setView(monthFromIso(value || min));
          setOpen((current) => !current);
        }}
        className={cn(
          "relative block w-full cursor-pointer text-left",
          fieldClass,
          "pr-12",
          open && "border-olive-500",
        )}
      >
        <span className={cn("block", value ? "text-ink" : "text-muted")}>
          {isoToDisplay(value) || "dd/mm/yyyy"}
        </span>
        <Calendar
          className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-ink"
          strokeWidth={1.7}
          aria-hidden="true"
        />
      </button>
      <input
        required={required}
        readOnly
        name={name}
        autoComplete="off"
        value={isoToDisplay(value)}
        className="sr-only"
      />
      {open ? (
        <div className="absolute z-30 mt-2 w-full min-w-[17rem] rounded-2xl border border-border bg-warm-white p-3 shadow-soft">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={!canGoPrev}
              aria-label={t("Mes anterior")}
              onClick={() => setView((current) => shiftMonth(current.year, current.month, -1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-olive-800 disabled:opacity-30"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.8} />
            </button>
            <p className="text-sm font-medium capitalize text-ink">{monthLabel}</p>
            <button
              type="button"
              aria-label={t("Mes siguiente")}
              onClick={() => setView((current) => shiftMonth(current.year, current.month, 1))}
              className="flex h-11 w-11 items-center justify-center rounded-full text-olive-800"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.8} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayLabels(locale).map((weekday, index) => (
              <span key={`${weekday}-${index}`} className="pb-1 text-[0.68rem] font-medium tracking-wide text-muted uppercase">
                {weekday}
              </span>
            ))}
            {Array.from({ length: leadingEmpty }, (_, index) => (
              <span key={`empty-${index}`} />
            ))}
            {Array.from({ length: daysInView }, (_, index) => {
              const day = index + 1;
              const iso = formatDateInput(new Date(view.year, view.month, day));
              const disabled = iso < min;
              const selected = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(day)}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-full text-sm",
                    disabled && "cursor-not-allowed text-sand-400",
                    !disabled && !selected && "text-ink hover:bg-olive-50",
                    selected && "bg-olive-500 text-white",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function openWhatsApp(url: string) {
  const popup = window.open(url, "_blank");
  if (popup) {
    popup.opener = null;
    return "popup" as const;
  }

  try {
    window.location.assign(url);
    return "redirect" as const;
  } catch {
    return "failed" as const;
  }
}

export function ReservationForm({ initialDome }: ReservationFormProps) {
  const { t, language } = useLanguage();
  const selectedDefault = domes.some((dome) => dome.slug === initialDome)
    ? initialDome
    : "";
  const domeLocked = Boolean(selectedDefault);
  const highestCapacity = Math.max(...domes.map((dome) => dome.capacity));

  const [domeSlug, setDomeSlug] = useState(selectedDefault ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState<string | undefined>();
  const [phoneError, setPhoneError] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const submittingRef = useRef(false);

  const selectedDome = useMemo(
    () => domes.find((dome) => dome.slug === domeSlug),
    [domeSlug],
  );

  const maxGuests = selectedDome?.capacity ?? highestCapacity;
  const today = formatDateInput(new Date());
  const minCheckIn = addDays(today, 1);
  const minCheckOut = checkIn ? addDays(checkIn, 1) : addDays(minCheckIn, 1);

  function clampGuests(current: string, capacity: number) {
    const count = Number(current);
    if (!Number.isFinite(count) || count < 1) return current;
    if (count > capacity) return String(capacity);
    return current;
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (honeypot.trim()) return;
    if (checkIn < minCheckIn || checkOut <= checkIn) {
      setFormError(t("Revisa las fechas: la salida debe ser posterior a la llegada."));
      return;
    }
    if (!phone || !isValidPhoneNumber(phone) || phone.length > FIELD_LIMITS.phone) {
      setPhoneError(t("Ingresa un número de teléfono válido."));
      return;
    }
    setFormError("");

    const guestCount = Math.min(Math.max(Number(guests) || 1, 1), maxGuests);
    submittingRef.current = true;
    setSubmitting(true);

    const result = submitReservationRequest({
      domeSlug,
      checkIn,
      checkOut,
      guests: guestCount,
      name: name.slice(0, FIELD_LIMITS.name),
      email: email.slice(0, FIELD_LIMITS.email),
      phone,
      message: message.slice(0, FIELD_LIMITS.message),
    }, t, language);

    const opened = openWhatsApp(result.whatsappUrl);
    if (opened === "popup") {
      setSubmittedUrl(result.whatsappUrl);
      return;
    }
    if (opened === "failed") {
      submittingRef.current = false;
      setSubmitting(false);
      setFormError(t("No se pudo abrir WhatsApp. Inténtalo de nuevo."));
    }
  }

  if (submittedUrl) {
    return (
      <div className="rounded-[24px] border border-border-soft bg-olive-50 px-6 py-10 text-center sm:px-10">
        <p className="heading-card text-3xl text-ink">{t("Continúa tu solicitud en WhatsApp.")}</p>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
          {t("Abrimos una conversación con los datos que completaste. Revisa el mensaje y presiona enviar para solicitar disponibilidad.")}
        </p>
        <Button href={submittedUrl} size="lg" className="mt-6">
          Abrir WhatsApp nuevamente
        </Button>
      </div>
    );
  }

  const fieldClass =
    "mt-2 w-full rounded-2xl border border-border bg-warm-white px-4 py-3 text-ink outline-none transition-colors duration-200 focus:border-olive-500";

  return (
    <form onSubmit={onSubmit} className="relative space-y-6">
      <div className="absolute -left-[10000px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <label>
          Company website
          <input
            type="text"
            name="company_website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </label>
      </div>
      <label className="block">
        <span className="text-sm font-medium text-ink">{t("Domo seleccionado")}</span>
        {domeLocked && selectedDome ? (
          <input
            readOnly
            name="dome"
            value={t(selectedDome.name)}
            className={`${fieldClass} cursor-default bg-sand-50`}
            aria-readonly="true"
          />
        ) : (
          <select
            required
            name="dome"
            value={domeSlug}
            onChange={(event) => {
              const nextSlug = event.target.value;
              setDomeSlug(nextSlug);
              const capacity = domes.find((dome) => dome.slug === nextSlug)?.capacity ?? highestCapacity;
              setGuests((current) => clampGuests(current, capacity));
            }}
            className={fieldClass}
          >
            <option value="" disabled>
              {t("Elige un domo")}
            </option>
            {domes.map((dome) => (
              <option key={dome.slug} value={dome.slug}>
                {t(dome.name)}
              </option>
            ))}
          </select>
        )}
      </label>

      <div className="grid gap-6 sm:grid-cols-2">
        <DateField
          label={t("Fecha de llegada")}
          name="check-in"
          value={checkIn}
          min={minCheckIn}
          required
          fieldClass={fieldClass}
          onChange={(nextCheckIn) => {
            setCheckIn(nextCheckIn);
            if (checkOut && nextCheckIn && checkOut <= nextCheckIn) {
              setCheckOut(addDays(nextCheckIn, 1));
            }
          }}
        />
        <DateField
          label={t("Fecha de salida")}
          name="check-out"
          value={checkOut}
          min={minCheckOut}
          required
          fieldClass={fieldClass}
          onChange={setCheckOut}
        />
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">{t("Huéspedes")}</span>
        <input
          required
          type="number"
          name="guests"
          inputMode="numeric"
          min={1}
          max={maxGuests}
          value={guests}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next)) {
              setGuests(event.target.value);
              return;
            }
            setGuests(String(Math.min(Math.max(next, 1), maxGuests)));
          }}
          className={fieldClass}
        />
        {selectedDome ? (
          <span className="mt-1 block text-xs text-muted">{t("Máximo {count} en este domo.", { count: maxGuests })}</span>
        ) : null}
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">{t("Nombre completo")}</span>
        <input
          required
          type="text"
          name="name"
          autoComplete="name"
          maxLength={FIELD_LIMITS.name}
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, FIELD_LIMITS.name))}
          className={fieldClass}
        />
      </label>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">{t("Correo electrónico")}</span>
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            maxLength={FIELD_LIMITS.email}
            value={email}
            onChange={(event) => setEmail(event.target.value.slice(0, FIELD_LIMITS.email))}
            className={fieldClass}
          />
        </label>
        <div>
          <label htmlFor="reservation-phone" className="block text-sm font-medium text-ink">
            {t("Teléfono")}
          </label>
          <PhoneInput
            international
            defaultCountry="CR"
            countryCallingCodeEditable={false}
            flags={flags}
            labels={
              language === "en"
                ? enPhoneLabels
                : language === "de"
                  ? dePhoneLabels
                  : language === "fr"
                    ? frPhoneLabels
                    : esPhoneLabels
            }
            value={phone}
            onChange={(value) => {
              setPhone(value);
              if (phoneError) setPhoneError("");
            }}
            className={cn("phone-input", phoneError && "phone-input-error")}
            numberInputProps={{
              id: "reservation-phone",
              name: "phone",
              autoComplete: "tel",
              inputMode: "tel",
              maxLength: FIELD_LIMITS.phone,
              "aria-invalid": Boolean(phoneError),
              "aria-describedby": phoneError ? "reservation-phone-error" : undefined,
            }}
          />
          {phoneError ? (
            <span id="reservation-phone-error" className="mt-1.5 block text-xs text-olive-800">
              {phoneError}
            </span>
          ) : null}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-ink">{t("Mensaje adicional")}</span>
        <textarea
          rows={4}
          name="message"
          autoComplete="off"
          maxLength={FIELD_LIMITS.message}
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, FIELD_LIMITS.message))}
          className={`${fieldClass} resize-y`}
        />
      </label>

      <p className="rounded-2xl bg-sand-50 px-4 py-3 text-sm leading-relaxed text-muted">
        {t("Esta solicitud no confirma automáticamente tu reserva. Nos pondremos en contacto contigo para verificar disponibilidad y continuar con el proceso.")}
      </p>

      {formError ? (
        <p id="reservation-form-error" role="alert" className="text-sm text-olive-800">
          {formError}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={submitting}>
        Enviar solicitud por WhatsApp
      </Button>
    </form>
  );
}
