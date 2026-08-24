import type { Metadata } from "next";
import { ExperiencesSection } from "@/components/home/ExperiencesSection";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  path: "/experiencias",
  title: "Experiencias en Monteverde",
  description:
    "Ideas para explorar Monteverde desde Macas Moon: bosque nuboso, café, puentes colgantes y aventura cerca de los domos.",
});

export default function ExperiencesPage() {
  return <ExperiencesSection />;
}
