import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { BookingStatus } from "@/components/reservar/BookingStatus";
import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function StatusPage() {
  return <section className="bg-sand-50 pt-24 pb-20 sm:pt-32 sm:pb-24">
    <Container className="max-w-2xl">
      <Suspense fallback={<p>Verificando la reserva…</p>}><BookingStatus /></Suspense>
    </Container>
  </section>;
}
