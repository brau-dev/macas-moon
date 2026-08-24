import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { homeServices } from "@/data/services";
import { TranslatedImage } from "@/i18n/TranslatedImage";
import { TranslatedText } from "@/i18n/LanguageProvider";

export function HomeServicesSection() {
  return (
    <section id="servicios" className="bg-sand-100">
      <Container className="py-16 sm:py-24 lg:py-28">
        <SectionHeading
          title="Haz tu estancia aún más especial"
          description="Pequeños detalles para disfrutar Monteverde a tu manera."
          className="max-w-2xl"
        />

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3">
          {homeServices.map((service) => (
            <Link
              key={service.id}
              href={service.href}
              className="group flex flex-col overflow-hidden rounded-[24px] bg-warm-white shadow-soft transition-[box-shadow,transform] duration-300 hover:shadow-lift"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <TranslatedImage
                  src={service.image}
                  alt={service.alt}
                  fill
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
                />
              </div>
              <div className="flex flex-1 flex-col px-6 py-6 sm:px-7">
                <h3 className="heading-card text-2xl text-ink">
                  <TranslatedText>{service.title}</TranslatedText>
                </h3>
                <p className="mt-3 text-[0.98rem] leading-relaxed text-muted">
                  <TranslatedText>{service.description}</TranslatedText>
                </p>
                <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-olive-700">
                  <TranslatedText>Conocer más</TranslatedText>
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transform-none"
                    aria-hidden="true"
                  />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <Button href="/servicios" variant="outline">
            Ver todos los servicios
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </Container>
    </section>
  );
}
