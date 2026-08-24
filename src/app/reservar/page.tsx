import type { Metadata } from "next";
import { ReservationForm } from "@/components/reservar/ReservationForm";
import { Container } from "@/components/ui/Container";
import { getDome } from "@/data/domes";
import { TranslatedText } from "@/i18n/LanguageProvider";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  path: "/reservar",
  title: "Solicita tu reserva",
  description:
    "Consulta disponibilidad en Macas Moon Glamping, Monteverde. Elige fechas y domo; te contactamos por WhatsApp para continuar la reserva.",
});

type ReservarPageProps = {
  searchParams: Promise<{ domo?: string }>;
};

export default async function ReservarPage({ searchParams }: ReservarPageProps) {
  const { domo } = await searchParams;
  const selected = domo ? getDome(domo) : undefined;

  return (
    <section className="bg-sand-50 pt-24 pb-20 sm:pt-32 sm:pb-24">
      <Container className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow text-olive-700">
            Macas Moon Glamping
          </p>
          <h1 className="heading-section mt-3 text-ink"><TranslatedText>Solicita tu reserva</TranslatedText></h1>
          <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-muted">
            <TranslatedText>Cuéntanos las fechas y el espacio que te gustaría. Revisamos disponibilidad y te escribimos para continuar.</TranslatedText>
          </p>
          {selected ? (
            <p className="mt-6 text-sm text-olive-800">
              <TranslatedText>Estás solicitando:</TranslatedText>{" "}
              <span className="font-semibold"><TranslatedText>{selected.name}</TranslatedText></span>
            </p>
          ) : null}
        </div>
        <div className="rounded-[24px] border border-border-soft bg-warm-white p-5 shadow-soft sm:rounded-[28px] sm:p-8">
          <ReservationForm initialDome={domo} />
        </div>
      </Container>
    </section>
  );
}
