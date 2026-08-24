"use client";

import Image from "next/image";
import { Button } from "@/components/ui/Button";
import type { Dome } from "@/types/dome";
import { useLanguage } from "@/i18n/LanguageProvider";

type DomeHeroProps = {
  dome: Dome;
};

export function DomeHero({ dome }: DomeHeroProps) {
  const { t } = useLanguage();

  return (
    <section className="dome-hero relative isolate min-h-[88svh] overflow-hidden lg:min-h-0">
      <Image
        src={dome.heroImage}
        alt={t(dome.name)}
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_58%] sm:object-[center_50%] lg:object-center"
      />
      <div className="hero-overlay absolute inset-0" />
      <div className="site-wrap relative z-10 flex min-h-[88svh] flex-col items-start justify-end pb-10 pt-[calc(var(--header-h)+0.75rem)] text-left sm:pb-12 lg:h-full lg:min-h-0 lg:pb-8">
        <div className="w-full max-w-2xl text-left text-warm-white">
          <p className="eyebrow mb-3 text-sand-300">
            {t(dome.category)}
          </p>
          <h1 className="heading-display text-left [text-wrap:pretty]">
            {t(dome.heroTitle)}
          </h1>
          <p className="hero-subtitle mt-4 max-w-lg text-left text-sand-100">
            {t(dome.heroSubtitle)}
          </p>
          <div className="mt-7">
            <Button href={`/reservar?domo=${dome.slug}`} size="lg">
              Reservar este domo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
