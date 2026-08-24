import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AmenitiesSection } from "@/components/domes/AmenitiesSection";
import { DomeCTA } from "@/components/domes/DomeCTA";
import { DomeGallery } from "@/components/domes/DomeGallery";
import { DomeHero } from "@/components/domes/DomeHero";
import { DomeHighlights } from "@/components/domes/DomeHighlights";
import { DomeLocation } from "@/components/domes/DomeLocation";
import { DomeStats } from "@/components/domes/DomeStats";
import { DomeVideoSection } from "@/components/domes/DomeVideoSection";
import { SpacesSection } from "@/components/domes/SpacesSection";
import { StayInfoSection } from "@/components/home/StayInfoSection";
import { domes, getDome } from "@/data/domes";
import { JsonLd } from "@/components/seo/JsonLd";
import { accommodationJsonLd } from "@/lib/jsonLd";
import { createPageMetadata } from "@/lib/seo";

type DomePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return domes.map((dome) => ({ slug: dome.slug }));
}

export async function generateMetadata({ params }: DomePageProps): Promise<Metadata> {
  const { slug } = await params;
  const dome = getDome(slug);
  if (!dome) {
    return {
      title: "Domo no encontrado",
      robots: { index: false, follow: false },
    };
  }

  const domeSeo: Record<string, { title: string; description: string }> = {
    "domo-amplio": {
      title: "Domo 1 · Amplio",
      description:
        "El Domo 1 de Macas Moon en Monteverde ofrece más espacio para hasta 4 huéspedes, con 2 camas, jacuzzi, terraza amplia y cocina.",
    },
    "domo-romantico": {
      title: "Domo 2 · Romántico",
      description:
        "El Domo 2 de Macas Moon en Monteverde es un espacio íntimo para 2 huéspedes, con jacuzzi privado, terraza y cocina entre el bosque.",
    },
  };

  const page = domeSeo[slug] ?? {
    title: dome.name,
    description: dome.shortDescription,
  };

  return createPageMetadata({
    path: `/domos/${slug}`,
    title: page.title,
    description: page.description,
    images: [{ url: dome.heroImage, alt: dome.name }],
  });
}

export default async function DomePage({ params }: DomePageProps) {
  const { slug } = await params;
  const dome = getDome(slug);
  if (!dome) notFound();

  return (
    <>
      <JsonLd data={accommodationJsonLd(dome)} />
      <div className="dome-first-screen">
        <DomeHero dome={dome} />
        <DomeStats dome={dome} />
      </div>
      <DomeHighlights dome={dome} />
      <DomeGallery dome={dome} />
      <DomeVideoSection dome={dome} />
      <AmenitiesSection dome={dome} />
      <SpacesSection dome={dome} />
      <StayInfoSection />
      <DomeLocation dome={dome} />
      <DomeCTA dome={dome} />
    </>
  );
}
