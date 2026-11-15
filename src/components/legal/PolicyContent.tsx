"use client";

import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { bookingConditions, privacySections, bookingPolicyVersion } from "@/data/reservation-policies";
import { useLanguage } from "@/i18n/LanguageProvider";
import { site } from "@/lib/site";

export function PolicyContent({ kind }: { kind: "conditions" | "privacy" }) {
  const { t } = useLanguage();
  const title = kind === "conditions" ? "Condiciones de reserva" : "Política de privacidad";
  const sections = kind === "conditions" ? bookingConditions : privacySections;
  return <Container className="max-w-3xl py-16 sm:py-24">
    <p className="eyebrow text-olive-700">{site.name}</p>
    <h1 className="mt-4 font-serif text-3xl text-ink sm:text-4xl">{t(title)}</h1>
    <p className="mt-3 text-sm text-muted">{t("Versión")}: {bookingPolicyVersion}</p>
    <div className="mt-10 space-y-8">
      {sections.map((section) => <section key={section.title}>
        <h2 className="font-serif text-xl text-ink">{t(section.title)}</h2>
        <p className="mt-3 leading-relaxed text-muted">{t(section.text)}</p>
      </section>)}
      <section className="rounded-2xl bg-sand-100 p-5">
        <h2 className="font-serif text-xl text-ink">{t("Contacto")}</h2>
        <p className="mt-3"><a className="text-olive-800 underline" href={`mailto:${site.contact.email}`}>{site.contact.email}</a></p>
        <p className="mt-2"><a className="text-olive-800 underline" href={site.contact.telUrl}>{site.contact.phone}</a></p>
        <p className="mt-2"><a className="text-olive-800 underline" href={site.contact.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a></p>
      </section>
    </div>
    <nav className="mt-10 flex flex-wrap gap-5 text-sm" aria-label={t("Información de la reserva")}>
      <Link className="text-olive-800 underline" href={kind === "conditions" ? "/privacidad" : "/condiciones-reserva"}>
        {t(kind === "conditions" ? "Política de privacidad" : "Condiciones de reserva")}
      </Link>
      <Link className="text-olive-800 underline" href="/reservar">{t("Reservar")}</Link>
    </nav>
  </Container>;
}
