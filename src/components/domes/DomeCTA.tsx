"use client";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import type { Dome } from "@/types/dome";
import { useLanguage } from "@/i18n/LanguageProvider";

export function DomeCTA({ dome }: { dome: Dome }) {
  const { t } = useLanguage();

  return (
    <section className="bg-sand-50">
      <Container className="py-16 text-center sm:py-24 lg:py-28">
        <h2 className="heading-display text-ink">{t(dome.ctaTitle)}</h2>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed font-normal text-muted">{t(dome.ctaText)}</p>
        <div className="mt-8">
          <Button href={`/reservar?domo=${dome.slug}`} size="lg">
            Reservar este domo
          </Button>
        </div>
      </Container>
    </section>
  );
}
