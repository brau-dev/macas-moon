import type { Language } from "@/i18n/LanguageProvider";
import { domes } from "@/data/domes";
import { whatsappMessageUrl } from "@/lib/site";

export type ReservationRequest = {
  domeSlug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  message: string;
};

export type ReservationResult = {
  ok: true;
  whatsappUrl: string;
};

type Translate = (text: string) => string;

function fieldLabel(spanish: string, t: Translate, language: Language) {
  if (language === "es") return spanish;
  const translated = t(spanish);
  return translated === spanish ? spanish : `${translated} / ${spanish}`;
}

export function submitReservationRequest(
  payload: ReservationRequest,
  t: Translate = (text) => text,
  language: Language = "es",
): ReservationResult {
  const selectedDome = domes.find((dome) => dome.slug === payload.domeSlug);
  const label = (spanish: string) => fieldLabel(spanish, t, language);
  const guestMessage = payload.message
    ? language === "es"
      ? `${t("Mensaje")}: ${payload.message}`
      : `${label("Mensaje del cliente")}:\n${payload.message}`
    : "";
  const lines = [
    t("Hola, quisiera consultar la disponibilidad en Macas Moon."),
    "",
    `${label("Domo")}: ${selectedDome ? t(selectedDome.name) : payload.domeSlug}`,
    `${label("Llegada")}: ${payload.checkIn}`,
    `${label("Salida")}: ${payload.checkOut}`,
    `${label("Huéspedes")}: ${payload.guests}`,
    "",
    `${label("Nombre")}: ${payload.name}`,
    `${label("Correo")}: ${payload.email}`,
    `${label("Teléfono")}: ${payload.phone}`,
    guestMessage,
  ].filter(Boolean);

  return { ok: true, whatsappUrl: whatsappMessageUrl(lines.join("\n")) };
}
