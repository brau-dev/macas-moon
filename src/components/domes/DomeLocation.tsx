"use client";

import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import type { Dome } from "@/types/dome";
import { useLanguage } from "@/i18n/LanguageProvider";
import { site } from "@/lib/site";

export function DomeLocation({ dome }: { dome: Dome }) {
  const { t } = useLanguage();

  return (
    <section className="bg-olive-50">
      <Container className="grid items-center gap-8 py-16 sm:gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
        <div>
          <h2 className="heading-section text-ink">{t("Entre las montañas de Monteverde")}</h2>
          <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed font-normal text-muted">
            {t("Los domos están en un entorno de bosque y montaña, a pocos minutos de Santa Elena y de los senderos que hacen único a este destino.")}
          </p>
          <div className="mt-7">
            <Button href={site.location.mapsUrl} variant="outline">
              Ver ubicación
            </Button>
          </div>
        </div>
        <div className="relative aspect-[4/3] min-h-0 overflow-hidden rounded-[24px] sm:aspect-auto sm:min-h-[300px]">
          <Image
            src={dome.locationImage}
            alt={t("{name} entre la naturaleza de Monteverde", { name: t(dome.name) })}
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
        </div>
      </Container>
    </section>
  );
}
