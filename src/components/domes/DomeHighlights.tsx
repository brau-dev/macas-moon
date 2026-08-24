"use client";

import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Dome } from "@/types/dome";
import { useLanguage } from "@/i18n/LanguageProvider";

export function DomeHighlights({ dome }: { dome: Dome }) {
  const { t } = useLanguage();

  return (
    <section className="bg-cream">
      <Container className="py-16 sm:py-24 lg:py-28">
        <SectionHeading title={dome.conceptTitle} description={dome.longDescription} />
        <div className="mt-10 grid gap-8 sm:mt-14 sm:grid-cols-3 sm:gap-10">
          {dome.highlights.map((item) => (
            <div key={item.title} className="max-w-sm">
              <h3 className="heading-card text-2xl text-ink">{t(item.title)}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted">{t(item.text)}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
