import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (process.env.NEXT_PUBLIC_BOOKING_TEST_MODE === "true" || process.env.TILOPAY_EXPECTED_ENVIRONMENT === "Test") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/admin", "/reservar/estado"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
