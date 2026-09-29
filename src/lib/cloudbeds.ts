import type { Language } from "@/i18n/LanguageProvider";

const PROPERTY_CODE_PATTERN = /^[A-Za-z0-9]{6}$/;
const ROOM_ID_PATTERN = /^\d+$/;

function publicEnv(name: string) {
  const values: Record<string, string | undefined> = {
    NEXT_PUBLIC_CLOUDBEDS_PROPERTY_CODE:
      process.env.NEXT_PUBLIC_CLOUDBEDS_PROPERTY_CODE,
    NEXT_PUBLIC_CLOUDBEDS_DOMO_ROMANTICO_RID:
      process.env.NEXT_PUBLIC_CLOUDBEDS_DOMO_ROMANTICO_RID,
    NEXT_PUBLIC_CLOUDBEDS_DOMO_AMPLIO_RID:
      process.env.NEXT_PUBLIC_CLOUDBEDS_DOMO_AMPLIO_RID,
    NEXT_PUBLIC_ONLINE_BOOKING_ENABLED:
      process.env.NEXT_PUBLIC_ONLINE_BOOKING_ENABLED,
    NEXT_PUBLIC_CLOUDBEDS_CALENDAR_ENABLED:
      process.env.NEXT_PUBLIC_CLOUDBEDS_CALENDAR_ENABLED,
  };

  return values[name]?.trim();
}

function enabled(name: string) {
  return publicEnv(name)?.toLowerCase() === "true";
}

const propertyCode = publicEnv("NEXT_PUBLIC_CLOUDBEDS_PROPERTY_CODE") ?? "";

const roomIds: Record<string, string | undefined> = {
  "domo-romantico": publicEnv("NEXT_PUBLIC_CLOUDBEDS_DOMO_ROMANTICO_RID"),
  "domo-amplio": publicEnv("NEXT_PUBLIC_CLOUDBEDS_DOMO_AMPLIO_RID"),
};

export const cloudbedsConfig = {
  propertyCode,
  onlineBookingEnabled:
    enabled("NEXT_PUBLIC_ONLINE_BOOKING_ENABLED") &&
    PROPERTY_CODE_PATTERN.test(propertyCode),
  calendarEnabled:
    enabled("NEXT_PUBLIC_CLOUDBEDS_CALENDAR_ENABLED") &&
    PROPERTY_CODE_PATTERN.test(propertyCode),
  roomIds,
} as const;

export function cloudbedsRoomId(domeSlug?: string) {
  if (!domeSlug) return undefined;
  const roomId = roomIds[domeSlug];
  return roomId && ROOM_ID_PATTERN.test(roomId) ? roomId : undefined;
}

export function cloudbedsBookingUrl(language: Language) {
  if (!PROPERTY_CODE_PATTERN.test(propertyCode)) return "";

  const locale = language === "es" ? "es" : language;
  return `https://hotels.cloudbeds.com/${locale}/reservation/${propertyCode}`;
}
