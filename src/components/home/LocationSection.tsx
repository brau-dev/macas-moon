"use client";

import Image from "next/image";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useLanguage } from "@/i18n/LanguageProvider";
import { site } from "@/lib/site";

export function LocationSection() {
  const { t } = useLanguage();

  return (
    <section id="ubicacion" className="home-screen bg-sand-100">
      <Container className="home-screen-inner home-screen-fill py-16 sm:py-20 lg:py-0">
        <SectionHeading title="Estamos en Monteverde" className="shrink-0" />
        <div className="mt-8 flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-border-soft bg-sand-50 lg:mt-6 lg:flex-1">
          <div className="relative min-h-[220px] overflow-hidden sm:min-h-[380px] lg:min-h-0 lg:flex-1">
            <Image
              src="/assets/otros/bosque-nuboso.webp"
              alt={t("Bosque nuboso de Monteverde")}
              fill
              sizes="(min-width: 1024px) 80vw, calc(100vw - 2.5rem)"
              className="location-image object-cover"
            />
            <div className="absolute inset-0 bg-olive-900/25" />
            <a
              href={site.location.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("Cómo llegar")}
              className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warm-white text-olive-700 shadow-soft">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="mt-3 rounded-full bg-warm-white/95 px-4 py-1.5 text-sm font-semibold text-ink">
                Macas Moon
              </span>
            </a>
          </div>
          <div className="grid shrink-0 gap-6 px-6 py-7 sm:px-8 md:grid-cols-2 md:items-center">
            <div>
              <p className="heading-card text-2xl text-ink">Monteverde</p>
              <p className="mt-1 text-muted">Puntarenas, Costa Rica</p>
            </div>
            <div className="md:justify-self-end">
              <Button href={site.location.mapsUrl} variant="outline" className="w-full md:w-auto">
                Cómo llegar
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
