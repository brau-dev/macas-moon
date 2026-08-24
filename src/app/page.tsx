import { DomesSection } from "@/components/home/DomesSection";
import { HomeCTA } from "@/components/home/HomeCTA";
import { HomeHero } from "@/components/home/HomeHero";
import { IntroSection } from "@/components/home/IntroSection";
import { LocationSection } from "@/components/home/LocationSection";
import { MonteverdeSection } from "@/components/home/MonteverdeSection";
import { FaqSection } from "@/components/home/FaqSection";
import { ReviewsSection } from "@/components/home/ReviewsSection";
import { HomeServicesSection } from "@/components/home/HomeServicesSection";
import { JsonLd } from "@/components/seo/JsonLd";
import { lodgingBusinessJsonLd } from "@/lib/jsonLd";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  path: "/",
  title: "Macas Moon | Glamping en Monteverde, Costa Rica",
  description:
    "Glamping en Monteverde, Costa Rica: los domos de Macas Moon ofrecen naturaleza, tranquilidad y comodidad entre las montañas del bosque nuboso.",
  absoluteTitle: true,
});

export default function HomePage() {
  return (
    <>
      <JsonLd data={lodgingBusinessJsonLd()} />
      <HomeHero />
      <IntroSection />
      <DomesSection />
      <HomeServicesSection />
      <MonteverdeSection />
      <ReviewsSection />
      <LocationSection />
      <FaqSection />
      <HomeCTA />
    </>
  );
}
