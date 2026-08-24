import type { Metadata } from "next";
import { Heart, Leaf } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { TranslatedText } from "@/i18n/LanguageProvider";
import { TranslatedImage } from "@/i18n/TranslatedImage";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  path: "/nosotros",
  title: "Nosotros",
  description:
    "Somos los anfitriones de Macas Moon Glamping en Monteverde. Creamos un rincón para compartir la calma del bosque y recibir a cada huésped con calidez.",
});

export default function AboutPage() {
  return (
    <section className="min-h-screen bg-warm-white">
      <Container className="grid gap-10 pt-28 pb-20 sm:pt-36 sm:pb-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pt-40">
        <div>
          <p className="eyebrow mb-4 text-olive-700">
            <TranslatedText>Nosotros</TranslatedText>
          </p>
          <h1 className="heading-display max-w-3xl text-ink">
            <TranslatedText>Un rincón creado para compartir Monteverde</TranslatedText>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            <TranslatedText>
              Somos los anfitriones detrás de Macas Moon Glamping. Este proyecto nació de nuestro deseo de compartir la tranquilidad de Monteverde y ofrecer un lugar donde cada huésped pueda sentirse bienvenido, descansar y reconectar con la naturaleza.
            </TranslatedText>
          </p>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-[28px] shadow-lift lg:aspect-[5/6]">
          <TranslatedImage
            src="/assets/Generales/IMG_9052.webp"
            alt="Macas Moon Glamping en Monteverde"
            fill
            priority
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent" />
        </div>
      </Container>

      <div className="bg-sand-50">
        <Container className="py-16 sm:py-24">
          <div className="mx-auto max-w-4xl rounded-[28px] border border-sand-300 bg-warm-white p-7 shadow-soft sm:p-12 lg:p-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-olive-100 text-olive-700">
              <Heart className="h-6 w-6" strokeWidth={1.7} aria-hidden="true" />
            </div>
            <h2 className="heading-section mt-7 text-ink">
              <TranslatedText>Nuestra Misión</TranslatedText>
            </h2>
            <div className="mt-6 space-y-5 text-base leading-relaxed text-muted sm:text-lg">
              <p>
                <TranslatedText>
                  Brindar a nuestros huéspedes una experiencia única de descanso y conexión con la naturaleza, ofreciendo un espacio acogedor, privado y confortable en el entorno de Monteverde.
                </TranslatedText>
              </p>
              <p>
                <TranslatedText>
                  En Macas Moon Glamping buscamos que cada estadía se convierta en un momento especial, combinando tranquilidad, naturaleza y atención a los detalles para crear recuerdos inolvidables.
                </TranslatedText>
              </p>
            </div>
            <Leaf className="mt-8 h-7 w-7 text-olive-500" strokeWidth={1.5} aria-hidden="true" />
          </div>
        </Container>
      </div>
    </section>
  );
}
