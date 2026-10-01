import { domes } from "@/data/domes";

const allDomeSlugs = domes.map((dome) => dome.slug);

export function getActiveDomeSlugs(): string[] {
  const configured = process.env.BOOKING_ACTIVE_DOMES;
  if (configured === undefined) return allDomeSlugs;

  const requested = configured.split(",").map((slug) => slug.trim());
  if (requested.some((slug) => !allDomeSlugs.includes(slug)) ||
    new Set(requested).size !== requested.length) return [];
  return requested;
}

export function isDomeActive(slug: string): boolean {
  return getActiveDomeSlugs().includes(slug);
}
