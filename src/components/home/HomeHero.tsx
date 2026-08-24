"use client";

import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n/LanguageProvider";

export function HomeHero() {
  const { t } = useLanguage();

  return (
    <section id="inicio" className="home-screen relative isolate min-h-svh overflow-hidden lg:h-svh">
      <Image
        src="/assets/domo2/IMG_7051.webp"
        alt={t("Domos de Macas Moon rodeados de vegetación y las montañas de Monteverde")}
        fill
        priority
        sizes="100vw"
        className="object-cover object-[32%_52%] sm:object-[38%_55%] lg:object-[42%_58%]"
      />
      <div className="hero-overlay absolute inset-0" />

      <div className="site-wrap relative z-10 flex min-h-svh flex-col items-start justify-end pb-24 pt-[calc(var(--header-h)+1rem)] text-left sm:pb-20 lg:justify-center lg:pb-10 lg:pt-[calc(var(--header-h)+1.5rem)]">
        <div className="w-full max-w-3xl text-left text-warm-white">
          <p className="eyebrow mb-3 text-sand-300 animate-fade-up sm:mb-4">
            Monteverde, Costa Rica
          </p>
          <h1 className="heading-hero text-left">
            {t("Descansa entre las montañas de Monteverde")}
          </h1>
          <p className="hero-subtitle mt-4 max-w-xl text-sand-100 animate-fade-up sm:mt-6">
            {t("Una experiencia entre naturaleza, tranquilidad y comodidad.")}
          </p>
          <div className="mt-8 animate-fade-up sm:mt-10">
            <Button href="#domos" size="lg">
              Descubrir los domos
            </Button>
          </div>
        </div>
      </div>

      <a
        href="#introduccion"
        className="absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-1 text-sand-200 sm:flex"
        aria-label={t("Explorar")}
      >
        <span className="eyebrow text-sand-200">{t("Explorar")}</span>
        <ChevronDown className="h-5 w-5 motion-safe:animate-bounce" />
      </a>
    </section>
  );
}
