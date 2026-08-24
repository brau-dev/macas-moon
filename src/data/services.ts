export const homeServices = [
  {
    id: "decoraciones",
    title: "Decoraciones especiales",
    description:
      "Celebra cumpleaños, aniversarios y momentos especiales con detalles preparados para tu llegada.",
    image: "/assets/servicios/decoracion-cumpleanos.webp",
    alt: "Domo de Macas Moon decorado para un cumpleaños con globos azules y plateados",
    href: "/servicios#decoraciones",
  },
  {
    id: "tours",
    title: "Tours en Monteverde",
    description:
      "Te ayudamos a organizar y reservar las experiencias que quieras vivir durante tu estancia.",
    image: "/assets/otros/bosque-nuboso.webp",
    alt: "Bosque nuboso de Monteverde cerca de Macas Moon",
    href: "/servicios#tours",
  },
  {
    id: "masajes",
    title: "Masajes",
    description:
      "Disfruta de un momento de descanso con servicio de masajes coordinado durante tu estancia.",
    image: "/assets/servicios/masaje-relajante.webp",
    alt: "Masaje relajante coordinado durante la estancia en Macas Moon",
    href: "/servicios#masajes",
  },
] as const;

export const decorationGallery = [
  {
    src: "/assets/servicios/decoracion-cumpleanos-oro.webp",
    alt: "Decoración de cumpleaños en tonos dorados dentro de un domo de Macas Moon",
  },
  {
    src: "/assets/servicios/decoracion-cumpleanos-rojo-ok.webp",
    alt: "Cama de un domo de Macas Moon decorada para un cumpleaños con globos rojos y plateados",
  },
] as const;

export const decorationPackages = [
  {
    id: "cumpleanos",
    title: "Paquete decoración · Cumpleaños",
    image: "/assets/servicios/decoracion-cumpleanos.webp",
    alt: "Paquete de decoración de cumpleaños en un domo de Macas Moon",
    price: "₡35.000",
    cta: "Reservar cumpleaños",
    whatsapp:
      "Hola, me gustaría reservar el paquete de decoración de cumpleaños para mi estancia en Macas Moon.",
    items: [
      "Un queque",
      "Decoración con globos",
      "Botella de vino",
      "Chocolates",
    ],
  },
  {
    id: "romantico",
    title: "Paquete decoración · Romántico",
    image: "/assets/servicios/decoracion-romantica.webp",
    alt: "Paquete de decoración romántica en un domo de Macas Moon",
    price: "₡35.000",
    cta: "Reservar romántico",
    whatsapp:
      "Hola, me gustaría reservar el paquete de decoración romántica para mi estancia en Macas Moon.",
    items: [
      "Un arreglo floral",
      "Decoración con globos",
      "Botella de vino",
      "Chocolates",
      "Pétalos de rosa",
    ],
  },
] as const;

export const decorationItems = [
  "Decoraciones de cumpleaños",
  "Celebraciones de aniversario",
  "Decoraciones para propuestas especiales",
  "Detalles personalizados según la ocasión",
] as const;

export const tourExperiences = [
  "Canopy entre las copas de los árboles",
  "Caminatas nocturnas por el bosque",
  "Puentes colgantes y senderos",
  "Bungee",
  "Paseos a caballo",
  "Tours de café, chocolate y caña de azúcar",
  "Cataratas y rincones escondidos",
  "Y muchas experiencias más",
] as const;

export const serviceWhatsappMessages = {
  tours:
    "Hola, me gustaría recibir ayuda para organizar tours durante mi estancia en Macas Moon.",
  massage:
    "Hola, me gustaría consultar disponibilidad para el servicio de masajes durante mi estancia en Macas Moon.",
} as const;
