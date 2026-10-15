import { domes } from "@/data/domes";

// An explicit choice must never silently turn into a booking for the other dome.
export function resolveBookingDome(requested: string, perNight: Record<string, number> | undefined) {
  const available = (slug: string) => Boolean(perNight && Number.isSafeInteger(perNight[slug]) && perNight[slug] > 0);
  if (requested) return domes.some(({ slug }) => slug === requested) && available(requested) ? requested : "";
  return domes.find(({ slug }) => available(slug))?.slug ?? "";
}
