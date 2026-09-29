"use client";

import { useState } from "react";
import Script from "next/script";
import { CalendarDays, CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n/LanguageProvider";
import {
  cloudbedsBookingUrl,
  cloudbedsConfig,
  cloudbedsRoomId,
} from "@/lib/cloudbeds";

const CLOUDBEDS_SCRIPT =
  "https://static1.cloudbeds.com/booking-engine/latest/static/js/immersive-experience/cb-immersive-experience.js";

type CloudbedsBookingProps = {
  initialDome?: string;
};

export function CloudbedsBooking({ initialDome }: CloudbedsBookingProps) {
  const { language, t } = useLanguage();
  const [scriptFailed, setScriptFailed] = useState(false);
  const roomId = cloudbedsRoomId(initialDome);
  const bookingUrl = cloudbedsBookingUrl(language);
  const showCalendar = cloudbedsConfig.calendarEnabled && !scriptFailed;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            icon: CalendarDays,
            title: t("Disponibilidad real"),
            text: t("Fechas sincronizadas con nuestros canales."),
          },
          {
            icon: CreditCard,
            title: t("Pago en línea"),
            text: t("Continúa al checkout seguro para confirmar."),
          },
          {
            icon: ShieldCheck,
            title: t("Confirmación segura"),
            text: t("Recibirás los detalles al finalizar el pago."),
          },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl bg-sand-50 p-4">
            <Icon className="h-5 w-5 text-olive-700" strokeWidth={1.7} aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </div>

      {showCalendar ? (
        <div className="cloudbeds-booking rounded-2xl border border-border bg-sand-50 p-4 sm:p-5">
          <Script
            id="cloudbeds-booking-engine"
            src={CLOUDBEDS_SCRIPT}
            strategy="afterInteractive"
            onError={() => setScriptFailed(true)}
          />
          <p className="mb-4 text-sm leading-relaxed text-muted">
            {roomId
              ? t("Consulta las fechas disponibles para el domo seleccionado.")
              : t("Consulta fechas disponibles y continúa para elegir tu domo.")}
          </p>
          <div key={`${language}-${roomId ?? "property"}`}>
            {roomId ? (
              <cb-accommodation-date-picker
                property-code={cloudbedsConfig.propertyCode}
                rid={roomId}
                button-label={t("Ver disponibilidad y reservar")}
                lang={language}
                class-name="macasmoon-cloudbeds-picker"
              />
            ) : (
              <cb-property-date-picker
                property-code={cloudbedsConfig.propertyCode}
                button-label={t("Ver disponibilidad y reservar")}
                layout="vertical"
                open-in-new-tab="false"
                lang={language}
                class-name="macasmoon-cloudbeds-picker"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-sand-50 p-5">
          <p className="text-sm leading-relaxed text-muted">
            {scriptFailed
              ? t("No pudimos cargar el calendario en este momento. Puedes continuar en el motor de reservas seguro.")
              : t("Consulta disponibilidad y completa la reserva en nuestro motor seguro.")}
          </p>
        </div>
      )}

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <Button href={bookingUrl} size="lg">
          Continuar para reservar y pagar
          <ExternalLink className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </Button>
        <p className="max-w-md text-xs leading-relaxed text-muted">
          {t("El pago se procesa fuera de esta página mediante el checkout seguro configurado para Macas Moon.")}
        </p>
      </div>
    </div>
  );
}
