import type { MetadataRoute } from "next";
import { domes } from "@/data/domes";
import { siteUrl } from "@/lib/site";

const staticPaths = ["/", "/nosotros", "/galeria", "/experiencias", "/servicios", "/reservar"];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...staticPaths.map((path) => ({
      url: `${siteUrl}${path}`,
    })),
    ...domes.map((dome) => ({
      url: `${siteUrl}/domos/${dome.slug}`,
    })),
  ];
}
