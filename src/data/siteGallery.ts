import { domes } from "@/data/domes";

export type SiteGalleryCategory = "general" | "domo1" | "domo2" | "monteverde";

export type SiteGalleryImage = {
  src: string;
  alt: string;
  category: SiteGalleryCategory;
  orientation?: "portrait" | "landscape";
};

const generalImages: SiteGalleryImage[] = [
  {
    src: "/assets/Generales/CCFCAF16-B7BC-4B2C-BCE9-C86055A95E71.webp",
    alt: "Atardecer sobre las montañas y los domos de Macas Moon",
    category: "general",
    orientation: "landscape",
  },
  {
    src: "/assets/Generales/IMG_9052.webp",
    alt: "Vista aérea de un domo rodeado por el bosque",
    category: "general",
    orientation: "landscape",
  },
  {
    src: "/assets/Generales/881F4D2D-570D-4C17-B220-2E267D02A2F2.webp",
    alt: "Ave entre el follaje de Macas Moon",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/Generales/CF7CECF1-AF00-4C85-89C3-F8B71D8B5DE5.webp",
    alt: "Monos carablanca en los árboles cercanos a los domos",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/Generales/IMG_0969.webp",
    alt: "Ave observada desde la terraza entre la vegetación",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/Generales/IMG_1156.webp",
    alt: "Tucán entre los árboles de Monteverde",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/Generales/IMG_7647.webp",
    alt: "Ardilla entre la vegetación que rodea los domos",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/Generales/IMG_7657.webp",
    alt: "Ardilla sobre un árbol cerca de Macas Moon",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/Generales/IMG_7779.webp",
    alt: "Atardecer entre los árboles y los domos",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/Generales/IMG_7888.webp",
    alt: "Ave silvestre posada en una rama",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/Generales/IMG_9325.webp",
    alt: "Arcoíris sobre el bosque y los domos",
    category: "general",
    orientation: "landscape",
  },
  {
    src: "/assets/Generales/IMG_9335.webp",
    alt: "Mono carablanca entre las ramas",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/Generales/IMG_9341.webp",
    alt: "Mono carablanca en el bosque de Macas Moon",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/Generales/IMG_9855.webp",
    alt: "Cielo rosado al anochecer sobre los domos",
    category: "general",
    orientation: "portrait",
  },
  {
    src: "/assets/otros/macasmoon-nocturno.webp",
    alt: "Macas Moon Glamping iluminado durante la noche",
    category: "general",
    orientation: "landscape",
  },
];

const domeImages: SiteGalleryImage[] = domes.flatMap((dome) =>
  dome.gallery.map((image) => ({
    src: image.src,
    alt: image.alt,
    category: dome.slug === "domo-amplio" ? "domo1" : "domo2",
    orientation: "landscape",
  })),
);

const monteverdeImages: SiteGalleryImage[] = [
  {
    src: "/assets/otros/bosque-nuboso.webp",
    alt: "Bosque nuboso de Monteverde",
    category: "monteverde",
    orientation: "landscape",
  },
  {
    src: "/assets/otros/hanging-bridges-monteverde.webp",
    alt: "Puentes colgantes entre el bosque de Monteverde",
    category: "monteverde",
    orientation: "landscape",
  },
];

export const siteGalleryImages = [...generalImages, ...domeImages, ...monteverdeImages];
