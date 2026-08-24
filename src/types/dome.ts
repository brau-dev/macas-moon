export const galleryCategories = [
  "habitacion",
  "cocina",
  "bano",
  "jacuzzi",
  "exterior",
  "vistas",
] as const;

export type GalleryCategory = (typeof galleryCategories)[number];

export type IconName =
  | "users"
  | "bed"
  | "bath"
  | "jacuzzi"
  | "utensils"
  | "wifi"
  | "car"
  | "coffee"
  | "snowflake"
  | "tv"
  | "sun"
  | "droplets"
  | "microwave"
  | "refrigerator"
  | "wind"
  | "sparkles"
  | "leaf"
  | "home"
  | "mountain"
  | "trees"
  | "star";

export type Amenity = {
  id: string;
  label: string;
  icon: IconName;
};

export type GalleryImage = {
  src: string;
  alt: string;
  category: GalleryCategory;
};

export type SpaceLayout = "full" | "half" | "wide";

export type Space = {
  id: string;
  name: string;
  description: string;
  image: string;
  layout: SpaceLayout;
};

export type DomeStat = {
  icon: IconName;
  label: string;
  value: string;
};

export type DomeHighlight = {
  title: string;
  text: string;
};

export type DomeVideo = {
  youtubeId: string;
  title: string;
};

export type Dome = {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  capacity: number;
  beds: number;
  bathrooms: number;
  heroImage: string;
  cardImage: string;
  locationImage: string;
  video?: DomeVideo;
  shortDescription: string;
  longDescription: string;
  conceptTitle: string;
  highlights: DomeHighlight[];
  stats: DomeStat[];
  amenities: Amenity[];
  gallery: GalleryImage[];
  spaces: Space[];
  ctaTitle: string;
  ctaText: string;
  preview: {
    guests: string;
    beds: string;
    bathrooms: string;
    extra: string;
  };
};
