"use client";

import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { useLanguage } from "@/i18n/LanguageProvider";
import { site } from "@/lib/site";

export function HomeCTA() {
  const { t } = useLanguage();

  return (
    <section className="relative isolate min-h-svh overflow-hidden lg:h-svh lg:max-h-svh">
      <Image
        src="/assets/otros/macasmoon-nocturno.webp"
        alt={t("Domo de Macas Moon iluminado al anochecer entre el bosque de Monteverde")}
        fill
        sizes="100vw"
        className="object-cover object-[center_48%] sm:object-[center_42%]"
      />
      <div className="cta-photo-overlay absolute inset-0" />
      <div className="site-wrap relative z-10 flex min-h-svh flex-col items-center justify-center py-16 pt-[calc(var(--header-h)+1rem)] text-center lg:h-full lg:min-h-0 lg:py-10">
        <div className="flex w-full max-w-xl flex-col items-center">
          <Image
            src={site.logoLight}
            alt={site.name}
            width={180}
            height={110}
            className="hero-logo-light mb-5 h-12 w-auto object-contain sm:mb-6 sm:h-16"
          />
          <h2 className="heading-display text-center text-warm-white">
            {t("Tu próxima escapada empieza aquí.")}
          </h2>
          <p className="hero-subtitle mt-4 max-w-md text-center text-sand-100">
            {t("Elige el espacio que mejor se siente y empieza a imaginar Monteverde desde el bosque.")}
          </p>
          <div className="mt-8">
            <Button href="#domos" size="lg">
              Elegir domo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
