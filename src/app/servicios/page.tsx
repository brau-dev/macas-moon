import type { Metadata } from "next";
import { ServicesContent } from "@/components/servicios/ServicesContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { servicesJsonLd } from "@/lib/jsonLd";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  path: "/servicios",
  title: "Servicios adicionales en Monteverde",
  description:
    "Haz tu estancia en Monteverde aún más especial con decoraciones para ocasiones especiales, organización de tours y servicio de masajes bajo reserva en Macas Moon Glamping.",
  images: [
    {
      url: "/assets/servicios/decoracion-propuesta-ok.webp",
      alt: "Decoración especial en un domo de Macas Moon Glamping",
    },
  ],
});

export default function ServiciosPage() {
  return (
    <>
      <JsonLd data={servicesJsonLd()} />
      <ServicesContent />
    </>
  );
}
