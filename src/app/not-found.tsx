import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { TranslatedText } from "@/i18n/LanguageProvider";

export const metadata: Metadata = {
  title: "Página no encontrada",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <section className="flex min-h-[80svh] items-center bg-cream pt-24">
      <Container className="py-20 text-center">
        <h1 className="heading-section text-ink"><TranslatedText>Página no encontrada</TranslatedText></h1>
        <p className="mx-auto mt-4 max-w-md text-muted">
          <TranslatedText>El camino se perdió entre las nubes. Volvamos al inicio.</TranslatedText>
        </p>
        <div className="mt-8">
          <Button href="/" size="lg">
            Ir al inicio
          </Button>
        </div>
      </Container>
    </section>
  );
}
