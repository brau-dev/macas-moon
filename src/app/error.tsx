"use client";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { TranslatedText } from "@/i18n/LanguageProvider";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <meta name="robots" content="noindex, nofollow" />
      <section className="flex min-h-[80svh] items-center bg-cream pt-24">
        <Container className="py-20 text-center">
          <h1 className="heading-section text-ink">
            <TranslatedText>Algo salió mal</TranslatedText>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-muted">
            <TranslatedText>
              No pudimos cargar esta página. Puedes intentarlo de nuevo o volver al inicio.
            </TranslatedText>
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button type="button" size="lg" onClick={() => reset()}>
              Intentar de nuevo
            </Button>
            <Button href="/" variant="outline" size="lg">
              Ir al inicio
            </Button>
          </div>
        </Container>
      </section>
    </>
  );
}
