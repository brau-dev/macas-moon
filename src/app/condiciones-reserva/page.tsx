import { PolicyContent } from "@/components/legal/PolicyContent";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({ path: "/condiciones-reserva", title: "Condiciones de reserva",
  description: "Condiciones de reserva, política de noches confirmadas no reembolsables y contacto de Macas Moon Glamping." });

export default function BookingConditionsPage() { return <PolicyContent kind="conditions" />; }
