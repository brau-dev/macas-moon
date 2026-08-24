import type { Amenity, Dome, GalleryImage } from "@/types/dome";

const sharedAmenities: Amenity[] = [
  { id: "kitchen", label: "Cocina equipada", icon: "utensils" },
  { id: "wifi", label: "Wi-Fi", icon: "wifi" },
  { id: "parking", label: "Estacionamiento", icon: "car" },
  { id: "coffee", label: "Cafetera", icon: "coffee" },
  { id: "ac", label: "Aire acondicionado", icon: "snowflake" },
  { id: "tv", label: "Televisión", icon: "tv" },
  { id: "hot-water", label: "Agua caliente", icon: "droplets" },
  { id: "microwave", label: "Microondas", icon: "microwave" },
  { id: "fridge", label: "Refrigeradora", icon: "refrigerator" },
  { id: "hairdryer", label: "Secadora de cabello", icon: "wind" },
  { id: "toiletries", label: "Amenidades de baño", icon: "sparkles" },
  { id: "nature", label: "Entorno de bosque", icon: "trees" },
];

const dome1Gallery: GalleryImage[] = [
  { src: "/assets/domo1/IMG_5501.webp", alt: "Domo 1 rodeado de naturaleza", category: "vistas" },
  { src: "/assets/domo1/IMG_5477.webp", alt: "Terraza y exterior del Domo 1", category: "exterior" },
  { src: "/assets/domo1/IMG_5479.webp", alt: "Habitación principal del Domo 1", category: "habitacion" },
  { src: "/assets/domo1/IMG_5481.webp", alt: "Interior y comedor del Domo 1", category: "habitacion" },
  { src: "/assets/domo1/IMG_5482.webp", alt: "Baño completo del Domo 1", category: "bano" },
  { src: "/assets/domo1/IMG_5483.webp", alt: "Cocina equipada del Domo 1", category: "cocina" },
  { src: "/assets/domo1/IMG_5484.webp", alt: "Muebles y fregadero de la cocina del Domo 1", category: "cocina" },
  { src: "/assets/domo1/IMG_5494.webp", alt: "Detalle de la cocina del Domo 1", category: "cocina" },
  { src: "/assets/domo1/IMG_5495.webp", alt: "Jacuzzi y terraza del Domo 1", category: "jacuzzi" },
  { src: "/assets/domo1/IMG_5500.webp", alt: "Cama del Domo 1", category: "habitacion" },
];

const dome2Gallery: GalleryImage[] = [
  { src: "/assets/domo2/IMG_7051.webp", alt: "Domo 2 entre las montañas de Monteverde", category: "vistas" },
  { src: "/assets/domo2/IMG_7050.webp", alt: "Vista aérea de los domos entre el bosque", category: "vistas" },
  { src: "/assets/domo2/IMG_7052.webp", alt: "Domo 2 rodeado de vegetación", category: "vistas" },
  { src: "/assets/domo2/IMG_7055.webp", alt: "Terraza y jacuzzi del Domo 2", category: "exterior" },
  { src: "/assets/domo2/IMG_7056.webp", alt: "Exterior privado del Domo 2", category: "exterior" },
  { src: "/assets/domo2/IMG_7061.webp", alt: "Jacuzzi del Domo 2 con vista a la naturaleza", category: "jacuzzi" },
  { src: "/assets/domo2/IMG_7066.webp", alt: "Cocina equipada del Domo 2", category: "cocina" },
  { src: "/assets/domo2/IMG_7067.webp", alt: "Cocina y ventana panorámica del Domo 2", category: "cocina" },
  { src: "/assets/domo2/IMG_7068.webp", alt: "Habitación del Domo 2", category: "habitacion" },
  { src: "/assets/domo2/IMG_7076.webp", alt: "Ducha del baño del Domo 2", category: "bano" },
  { src: "/assets/domo2/IMG_7078.webp", alt: "Baño completo del Domo 2", category: "bano" },
  { src: "/assets/domo2/IMG_7079.webp", alt: "Lavamanos del baño del Domo 2", category: "bano" },
  { src: "/assets/domo2/IMG_7080.webp", alt: "Espejo y lavamanos del Domo 2", category: "bano" },
  { src: "/assets/domo2/IMG_7081.webp", alt: "Amenidades de baño del Domo 2", category: "bano" },
  { src: "/assets/domo2/IMG_7085.webp", alt: "Estación de café del Domo 2", category: "cocina" },
  { src: "/assets/domo2/IMG_7087.webp", alt: "Comedor del Domo 2", category: "cocina" },
  { src: "/assets/domo2/IMG_7092.webp", alt: "Toallas preparadas en el Domo 2", category: "bano" },
  { src: "/assets/domo2/IMG_7098.webp", alt: "Jacuzzi privado del Domo 2", category: "jacuzzi" },
];

const domeCatalog: Dome[] = [
  {
    slug: "domo-romantico",
    name: "Macas Moon Domo 2 · Romántico",
    category: "ESCAPADA PARA DOS",
    tagline: "Privacidad, tranquilidad y conexión en pareja.",
    heroTitle: "Una escapada para dos",
    heroSubtitle:
      "Privacidad, naturaleza y noches bajo las estrellas de Monteverde.",
    capacity: 2,
    beds: 1,
    bathrooms: 1,
    heroImage: "/assets/domo2/IMG_7052.webp",
    cardImage: "/assets/domo2/IMG_7055.webp",
    locationImage: "/assets/domo2/IMG_7051.webp",
    shortDescription:
      "Un espacio íntimo entre las montañas de Monteverde, pensado para desconectar y disfrutar en pareja.",
    longDescription:
      "Un refugio íntimo en medio del bosque nuboso de Monteverde. Un lugar para bajar el ritmo, disfrutar de la compañía y vivir una experiencia diferente, rodeados de naturaleza y confort.",
    conceptTitle: "Hecho para desconectar juntos",
    highlights: [
      {
        title: "Un espacio solo para ustedes",
        text: "Un espacio diseñado para disfrutar en pareja, con la tranquilidad y privacidad que necesitas para conectar, conversar y crear momentos especiales lejos del ruido y las distracciones.",
      },
      {
        title: "Jacuzzi privado",
        text: "Relájate en tu jacuzzi privado mientras contemplas el entorno natural. El plan perfecto para disfrutar de una tarde tranquila, una noche bajo las estrellas o simplemente dejar pasar el tiempo.",
      },
      {
        title: "Noches rodeadas de naturaleza",
        text: "Cuando cae la noche, el bosque se transforma. El sonido de la naturaleza, el aire fresco de la montaña y el cielo sobre el domo crean el escenario perfecto para una noche diferente.",
      },
    ],
    stats: [
      { icon: "users", label: "Huéspedes", value: "2 huéspedes" },
      { icon: "bed", label: "Cama", value: "1 cama" },
      { icon: "bath", label: "Baño", value: "1 baño" },
      { icon: "jacuzzi", label: "Jacuzzi", value: "Jacuzzi privado" },
      { icon: "utensils", label: "Cocina", value: "Cocina" },
      { icon: "sun", label: "Terraza", value: "Terraza" },
    ],
    amenities: [
      { id: "jacuzzi", label: "Jacuzzi privado", icon: "jacuzzi" },
      { id: "terrace", label: "Terraza", icon: "sun" },
      ...sharedAmenities,
    ],
    gallery: dome2Gallery,
    spaces: [
      {
        id: "habitacion",
        name: "Habitación",
        description:
          "Un espacio sereno y acogedor, rodeado de naturaleza para despertar sin prisa.",
        image: "/assets/domo2/IMG_7068.webp",
        layout: "full",
      },
      {
        id: "jacuzzi",
        name: "Jacuzzi",
        description:
          "Un rincón privado para relajarse, conversar y contemplar el bosque.",
        image: "/assets/domo2/IMG_7061.webp",
        layout: "half",
      },
      {
        id: "cocina",
        name: "Cocina",
        description:
          "Todo lo necesario para disfrutar un café, un desayuno o una cena sin salir del domo.",
        image: "/assets/domo2/IMG_7066.webp",
        layout: "half",
      },
      {
        id: "exterior",
        name: "Exterior",
        description:
          "Una terraza rodeada de aire fresco, vegetación y el paisaje de Monteverde.",
        image: "/assets/domo2/IMG_7055.webp",
        layout: "wide",
      },
      {
        id: "bano",
        name: "Baño",
        description:
          "Un espacio privado y confortable, con agua caliente para disfrutar el clima de montaña.",
        image: "/assets/domo2/IMG_7078.webp",
        layout: "half",
      },
    ],
    ctaTitle: "¿Listos para desconectar?",
    ctaText: "Vive Monteverde desde un espacio pensado para dos.",
    preview: {
      guests: "2 huéspedes",
      beds: "1 cama",
      bathrooms: "1 baño",
      extra: "Jacuzzi",
    },
  },
  {
    slug: "domo-amplio",
    name: "Macas Moon Domo 1 · Amplio",
    category: "MÁS ESPACIO PARA COMPARTIR",
    tagline: "Mayor amplitud y comodidad para disfrutar juntos.",
    heroTitle: "Un espacio para compartir",
    heroSubtitle: "Más espacio, más comodidad y Monteverde alrededor.",
    capacity: 4,
    beds: 2,
    bathrooms: 1,
    heroImage: "/assets/domo1/IMG_5501.webp",
    cardImage: "/assets/domo1/IMG_5495.webp",
    locationImage: "/assets/domo1/IMG_5501.webp",
    video: {
      youtubeId: "KIKsIjOI_jE",
      title: "Video del Domo 1 de Macas Moon",
    },
    shortDescription:
      "Un espacio amplio entre naturaleza, pensado para disfrutar Monteverde con mayor comodidad.",
    longDescription:
      "Un domo diseñado para quienes quieren disfrutar de Monteverde con comodidad, amplitud y el encanto de estar rodeados de naturaleza.",
    conceptTitle: "Más espacio para vivir la experiencia",
    highlights: [
      {
        title: "Comodidad que se siente",
        text: "Un ambiente amplio, más comodidad y rincones pensados para que descansar también sea parte de la aventura.",
      },
      {
        title: "Un refugio para compartir",
        text: "Con capacidad para hasta cuatro huéspedes, es ideal para una escapada en pareja, una pequeña familia o un viaje entre amigos.",
      },
      {
        title: "Después de la aventura",
        text: "Prepara algo rico, relájate en la terraza o simplemente disfruta de una tarde tranquila. Aquí también empieza la parte más bonita del viaje.",
      },
    ],
    stats: [
      { icon: "users", label: "Huéspedes", value: "4 huéspedes" },
      { icon: "bed", label: "Camas", value: "2 camas" },
      { icon: "bath", label: "Baño", value: "1 baño" },
      { icon: "jacuzzi", label: "Jacuzzi", value: "Jacuzzi" },
      { icon: "utensils", label: "Cocina", value: "Cocina" },
      { icon: "sun", label: "Terraza", value: "Terraza amplia" },
    ],
    amenities: [
      { id: "jacuzzi", label: "Jacuzzi", icon: "jacuzzi" },
      { id: "terrace", label: "Terraza amplia", icon: "sun" },
      ...sharedAmenities,
    ],
    gallery: dome1Gallery,
    spaces: [
      {
        id: "habitacion",
        name: "Habitación",
        description:
          "Un espacio amplio y acogedor, con dos camas y todo lo necesario para descansar cómodamente.",
        image: "/assets/domo1/IMG_5479.webp",
        layout: "full",
      },
      {
        id: "jacuzzi",
        name: "Jacuzzi",
        description:
          "Agua caliente y naturaleza alrededor para relajarse después de un día en Monteverde.",
        image: "/assets/domo1/IMG_5495.webp",
        layout: "half",
      },
      {
        id: "cocina",
        name: "Cocina",
        description:
          "Todo lo esencial para preparar café, desayunos o una comida sin prisa.",
        image: "/assets/domo1/IMG_5484.webp",
        layout: "half",
      },
      {
        id: "exterior",
        name: "Exterior",
        description:
          "Una terraza amplia para disfrutar del aire fresco y contemplar el bosque.",
        image: "/assets/domo1/IMG_5477.webp",
        layout: "wide",
      },
      {
        id: "bano",
        name: "Baño",
        description:
          "Un baño privado, luminoso y cómodo para terminar el día con tranquilidad.",
        image: "/assets/domo1/IMG_5482.webp",
        layout: "half",
      },
    ],
    ctaTitle: "¿Listos para compartir Monteverde?",
    ctaText: "Descubre un espacio con más comodidad para disfrutar juntos.",
    preview: {
      guests: "4 huéspedes",
      beds: "2 camas",
      bathrooms: "1 baño",
      extra: "Jacuzzi",
    },
  },
];

const DOME_DISPLAY_ORDER: Record<string, number> = {
  "domo-amplio": 0,
  "domo-romantico": 1,
};

export const domes: Dome[] = [...domeCatalog].sort(
  (a, b) => (DOME_DISPLAY_ORDER[a.slug] ?? 99) - (DOME_DISPLAY_ORDER[b.slug] ?? 99),
);

export function getDome(slug: string) {
  return domes.find((dome) => dome.slug === slug);
}
