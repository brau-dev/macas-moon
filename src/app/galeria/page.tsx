import type { Metadata } from "next";
import { SiteGallery } from "@/components/gallery/SiteGallery";
import { Container } from "@/components/ui/Container";
import { TranslatedText } from "@/i18n/LanguageProvider";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  path: "/galeria",
  title: "Galería",
  description:
    "Fotografías de los domos, jacuzzis, terrazas y el bosque de Macas Moon Glamping en Monteverde, Costa Rica.",
});

export default function GalleryPage() {
  return (
    <section className="min-h-screen bg-warm-white">
      <Container className="pt-28 pb-20 sm:pt-36 sm:pb-28 lg:pt-40">
        <div className="max-w-3xl">
          <p className="eyebrow mb-4 text-olive-700">
            <TranslatedText>Galería</TranslatedText>
          </p>
          <h1 className="heading-display text-ink">
            <TranslatedText>Todas nuestras imágenes en un solo lugar</TranslatedText>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            <TranslatedText>
              Explora los domos, sus espacios y la naturaleza que forma parte de cada estadía en Macas Moon.
            </TranslatedText>
          </p>
        </div>
        <SiteGallery />
      </Container>
    </section>
  );
}
