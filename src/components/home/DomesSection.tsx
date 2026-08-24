"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bath, BedDouble, Users, Waves } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { domes } from "@/data/domes";
import { useLanguage } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/cn";

export function DomesSection() {
  const { t } = useLanguage();

  return (
    <section id="domos" className="home-screen bg-sand-100">
      <Container className="home-screen-inner home-screen-fill py-16 sm:py-20 lg:py-0">
        <SectionHeading
          title="Encuentra tu espacio"
          description="Dos formas de vivir Monteverde."
          className="shrink-0"
        />
        <div className="mt-8 grid gap-8 lg:mt-6 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
          {domes.map((dome, index) => (
            <Link
              key={dome.slug}
              href={`/domos/${dome.slug}`}
              className="group flex min-h-0 flex-col overflow-hidden rounded-[28px] bg-warm-white shadow-soft transition-[box-shadow,transform] duration-300 hover:shadow-lift lg:h-full"
            >
              <div className="relative aspect-[5/4] overflow-hidden sm:aspect-[5/4] lg:aspect-auto lg:min-h-0 lg:flex-1">
                <Image
                  src={dome.cardImage}
                  alt={t(dome.name)}
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                <div
                  className={cn(
                    "absolute inset-0",
                    index === 0
                      ? "bg-gradient-to-t from-ink/35 via-transparent to-transparent"
                      : "bg-gradient-to-t from-olive-900/25 via-transparent to-transparent",
                  )}
                />
              </div>
              <div className="flex shrink-0 flex-col gap-3 px-6 py-6 sm:px-8 lg:py-5">
                <Badge tone={index === 0 ? "sand" : "olive"}>{dome.category}</Badge>
                <h3 className="heading-card text-2xl text-ink sm:text-3xl">{t(dome.name)}</h3>
                <p className="text-[0.98rem] leading-relaxed font-normal text-muted">
                  {t(dome.shortDescription)}
                </p>
                <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-olive-800">
                  <li className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4" strokeWidth={1.6} />
                    {t(dome.preview.guests)}
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <BedDouble className="h-4 w-4" strokeWidth={1.6} />
                    {t(dome.preview.beds)}
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <Bath className="h-4 w-4" strokeWidth={1.6} />
                    {t(dome.preview.bathrooms)}
                  </li>
                  <li className="inline-flex items-center gap-1.5">
                    <Waves className="h-4 w-4" strokeWidth={1.6} />
                    {t(dome.preview.extra)}
                  </li>
                </ul>
                <span className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-olive-700">
                  {t("Descubrir este domo")}
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
