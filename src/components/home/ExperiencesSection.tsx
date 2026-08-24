"use client";

import Image from "next/image";
import { ArrowUpRight, Compass } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { monteverdePlaces } from "@/data/monteverdePlaces";
import { useLanguage } from "@/i18n/LanguageProvider";

export function ExperiencesSection() {
  const { t } = useLanguage();

  return (
    <section className="min-h-screen bg-warm-white">
      <Container className="pt-24 pb-20 sm:pt-40 sm:pb-32">
        <SectionHeading
          as="h1"
          eyebrow="Tours y lugares"
          title="Experiencias en Monteverde"
          description="Ideas para explorar el bosque nuboso, descubrir sabores locales y disfrutar la montaña durante tu estadía."
          className="max-w-3xl"
        />

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {monteverdePlaces.map((place, index) => (
            <article
              key={place.id}
              className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-sand-300 bg-sand-50 shadow-soft transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={place.image}
                  alt={place.name}
                  fill
                  priority={index === 0}
                  sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <Badge>{place.category}</Badge>
                <h3 className="heading-card mt-4 text-2xl text-ink">{place.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{t(place.description)}</p>
                <p className="mt-5 flex items-center gap-2 text-sm font-medium text-olive-800">
                  <Compass className="h-4 w-4" strokeWidth={1.6} />
                  {t(place.highlight)}
                </p>
                <a
                  href={place.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-olive-700 transition-colors hover:text-olive-900"
                >
                  {t("Visitar sitio oficial")}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
