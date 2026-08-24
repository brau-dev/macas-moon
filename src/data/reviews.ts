export type Review = {
  id: string;
  quote: string;
  name: string;
  source: "Google Maps";
  rating: 5;
};

export const reviewSummary = {
  rating: "5.0",
  label: "Reseñas de nuestros huéspedes",
  source: "Google Maps",
};

export const reviews: Review[] = [
  {
    id: "maricela-gutierrez",
    quote:
      "El lugar es precioso! Ideal para descansar y conectar con la naturaleza !",
    name: "Maricela Gutierrez",
    source: "Google Maps",
    rating: 5,
  },
  {
    id: "fab-solis",
    quote: "Excelente lugar para compartir en pareja",
    name: "Fab Solis",
    source: "Google Maps",
    rating: 5,
  },
  {
    id: "jhuneysi-c",
    quote: "Recomendadisimo",
    name: "Jhuneysi C",
    source: "Google Maps",
    rating: 5,
  },
  {
    id: "brian",
    quote:
      "Excelentes instalaciones y los dueños son encantadores. Si buscas una experiencia única en la zona de Monteverde, ¡esta es una opción imperdible!",
    name: "Brian",
    source: "Google Maps",
    rating: 5,
  },
];
