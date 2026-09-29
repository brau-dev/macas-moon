import type { Metadata } from "next";
import { DirectBookingForm } from "@/components/reservar/DirectBookingForm";
import { Container } from "@/components/ui/Container";
import { getDome } from "@/data/domes";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  path: "/reservar", title: "Reserva tu domo",
  description: "Consulta disponibilidad y reserva en línea tu estadía en Macas Moon.",
});

export default async function ReservarPage({ searchParams }: {
  searchParams: Promise<{ domo?: string }>;
}) {
  const { domo } = await searchParams;
  return <section className="bg-sand-50 pt-24 pb-20 sm:pt-32 sm:pb-24">
    <Container className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
      <div>
        <p className="eyebrow text-olive-700">Macas Moon Glamping</p>
        <h1 className="heading-section mt-3 text-ink">Reserva tu domo</h1>
        <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-muted">
          Consulta el calendario, elige tus noches y completa tus datos. Te llevaremos a Tilopay para pagar con tarjeta o las billeteras disponibles en tu dispositivo. Confirmaremos la reserva al verificar el pago.
        </p>
        {domo && getDome(domo) ? <p className="mt-6 text-sm text-olive-800">Seleccionado: {getDome(domo)?.name}</p> : null}
      </div>
      <div className="rounded-[24px] border border-border-soft bg-warm-white p-5 shadow-soft sm:rounded-[28px] sm:p-8">
        <DirectBookingForm initialDome={domo} />
      </div>
    </Container>
  </section>;
}
