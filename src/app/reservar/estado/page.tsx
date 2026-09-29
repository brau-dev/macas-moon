import { Suspense } from "react";
import { Container } from "@/components/ui/Container";
import { BookingStatus } from "@/components/reservar/BookingStatus";

export default function StatusPage() {
  return <section className="bg-sand-50 pt-24 pb-20 sm:pt-32 sm:pb-24">
    <Container className="max-w-2xl">
      <Suspense fallback={<p>Verificando la reserva…</p>}><BookingStatus /></Suspense>
    </Container>
  </section>;
}
