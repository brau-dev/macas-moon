export type HouseRule = {
  id: string;
  title: string;
  text: string;
};

export const houseRules: HouseRule[] = [
  {
    id: "guests",
    title: "Máximo de huéspedes",
    text: "La capacidad depende del alojamiento reservado: 4 personas en el Domo 1 amplio y 2 en el Domo 2 romántico. No se admiten huéspedes adicionales sin aviso previo.",
  },
  {
    id: "pets",
    title: "Mascotas",
    text: "Por respeto a la fauna del bosque y al descanso de otros huéspedes, no se permiten mascotas en esta etapa.",
  },
  {
    id: "smoking",
    title: "No fumar",
    text: "No está permitido fumar dentro del domo ni en la terraza cubierta. El entorno es bosque y la madera requiere cuidado.",
  },
  {
    id: "parties",
    title: "No fiestas",
    text: "Macas Moon es un espacio de descanso. No se permiten fiestas, eventos ni música a alto volumen.",
  },
  {
    id: "quiet",
    title: "Horario de silencio",
    text: "Pedimos especial cuidado entre las 10:00 p. m. y las 7:00 a. m. para conservar la calma de la montaña.",
  },
  {
    id: "safety",
    title: "Seguridad",
    text: "El check-in es autónomo. Conserva el código de acceso y no lo compartas. En caso de emergencia, usa los números que enviamos antes de tu llegada.",
  },
  {
    id: "cancel",
    title: "Cancelación",
    text: "Las condiciones de cancelación se confirman al aceptar la reserva. Esta solicitud inicial no genera un cargo automático.",
  },
  {
    id: "nature",
    title: "Cuidado del entorno",
    text: "No alimentes animales silvestres, no dejes residuos y permanece en los senderos y terrazas habilitados.",
  },
];
