"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import { site } from "@/lib/site";

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12.04 2C6.58 2 2.15 6.4 2.15 11.83c0 1.74.46 3.44 1.33 4.94L2 22l5.4-1.41a10.05 10.05 0 0 0 4.64 1.17h.01c5.46 0 9.89-4.4 9.89-9.83C21.94 6.4 17.5 2 12.04 2Zm5.76 13.98c-.24.68-1.4 1.25-1.94 1.33-.5.07-1.13.1-1.82-.11-.42-.13-.95-.31-1.64-.6-2.89-1.25-4.77-4.16-4.92-4.35-.14-.2-1.18-1.57-1.18-3 0-1.42.75-2.12 1.01-2.41.27-.29.58-.36.77-.36h.55c.18 0 .42-.07.66.5.24.58.82 2 .89 2.15.07.14.12.31.02.5-.1.2-.15.31-.3.48l-.44.5c-.15.17-.3.35-.13.68.18.34.8 1.32 1.72 2.14 1.18 1.05 2.17 1.38 2.51 1.54.34.15.54.13.74-.08.2-.2.84-.98 1.07-1.32.22-.34.45-.28.76-.17.31.11 1.96.92 2.3 1.09.34.17.56.25.64.39.08.14.08.82-.16 1.5Z" />
    </svg>
  );
}

export function WhatsAppButton() {
  const { t } = useLanguage();

  return (
    <a
      href={site.contact.whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("Contactar por WhatsApp")}
      className="fixed right-4 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-40 flex h-12 w-12 items-center justify-center rounded-full bg-olive-500 text-white shadow-soft transition-colors duration-300 hover:bg-olive-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive-600 focus-visible:ring-offset-2 focus-visible:ring-offset-warm-white md:right-6 md:bottom-6 [.nav-mobile-open_&]:hidden"
    >
      <WhatsAppIcon className="h-6 w-6" />
    </a>
  );
}
