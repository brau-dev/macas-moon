export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.macasmoon.com";

export const sitePhone = {
  display: "+506 7111 0261",
  e164: "+50671110261",
  whatsapp: "50671110261",
} as const;

const whatsappUrl =
  process.env.NEXT_PUBLIC_WHATSAPP_URL ?? `https://wa.me/${sitePhone.whatsapp}`;

export const site = {
  name: "Macas Moon Glamping",
  shortName: "Macas Moon",
  location: {
    area: "Monteverde",
    province: "Puntarenas",
    country: "Costa Rica",
    mapsUrl:
      "https://www.google.com/maps/place/Macas+Moon+Glamping/@10.3342648,-84.8540335,17z/data=!4m6!3m5!1s0x8fa01b00010bd2c1:0x46f1f988a6642100!8m2!3d10.3342648!4d-84.8540335!16s%2Fg%2F11y367hsc5",
  },
  contact: {
    whatsappUrl,
    email: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "macasmoonglamping@gmail.com",
    phone: sitePhone.display,
    telephone: sitePhone.e164,
    telUrl: `tel:${sitePhone.e164}`,
    instagram: "https://www.instagram.com/macasmoonglampingscr",
    tiktok: "https://www.tiktok.com/@macasmoonglampingscr",
  },
  checkIn: "Desde las 3:00 p. m.",
  checkOut: "Hasta las 11:00 a. m.",
  arrival: "Check-in autónomo",
  logo: "/assets/Macamoon_logo_transparent_trimmed.webp",
  logoLight: "/assets/Macamoon_logo_light.webp",
} as const;

export function whatsappMessageUrl(text: string) {
  const separator = site.contact.whatsappUrl.includes("?") ? "&" : "?";
  return `${site.contact.whatsappUrl}${separator}text=${encodeURIComponent(text)}`;
}
