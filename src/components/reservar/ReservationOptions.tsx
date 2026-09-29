"use client";

import { useState } from "react";
import { CreditCard, MessageCircle } from "lucide-react";
import { CloudbedsBooking } from "@/components/reservar/CloudbedsBooking";
import { ReservationForm } from "@/components/reservar/ReservationForm";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cloudbedsConfig } from "@/lib/cloudbeds";
import { cn } from "@/lib/cn";

type ReservationOptionsProps = {
  initialDome?: string;
};

type BookingMode = "online" | "whatsapp";

export function ReservationOptions({ initialDome }: ReservationOptionsProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<BookingMode>("online");

  if (!cloudbedsConfig.onlineBookingEnabled) {
    return <ReservationForm initialDome={initialDome} />;
  }

  const options: Array<{
    id: BookingMode;
    label: string;
    description: string;
    icon: typeof CreditCard;
  }> = [
    {
      id: "online",
      label: t("Reservar y pagar"),
      description: t("Confirma tu estadía en línea."),
      icon: CreditCard,
    },
    {
      id: "whatsapp",
      label: t("Coordinar por WhatsApp"),
      description: t("Solicita ayuda o coordina otro método de pago."),
      icon: MessageCircle,
    },
  ];

  return (
    <div>
      <div
        role="tablist"
        aria-label={t("Opciones de reserva")}
        className="grid gap-2 rounded-2xl bg-sand-50 p-2 sm:grid-cols-2"
      >
        {options.map(({ id, label, description, icon: Icon }) => {
          const selected = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`booking-tab-${id}`}
              aria-selected={selected}
              aria-controls={`booking-panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setMode(id)}
              className={cn(
                "rounded-xl px-4 py-3 text-left transition-colors",
                selected
                  ? "bg-warm-white text-ink shadow-soft"
                  : "text-muted hover:bg-sand-100 hover:text-ink",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                {label}
              </span>
              <span className="mt-1 block text-xs leading-relaxed">{description}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`booking-panel-${mode}`}
        aria-labelledby={`booking-tab-${mode}`}
        className="mt-7"
      >
        {mode === "online" ? (
          <CloudbedsBooking initialDome={initialDome} />
        ) : (
          <ReservationForm initialDome={initialDome} />
        )}
      </div>
    </div>
  );
}
