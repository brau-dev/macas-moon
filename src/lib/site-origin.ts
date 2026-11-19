import "server-only";
import { siteUrl } from "@/lib/site";
// Netlify supplies URL automatically for both builds and Functions.
// Local development does not need a public URL for no-payment tests.
export function getSiteOrigin() {
  const value = process.env.URL;
  if (value) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) return null;
      if (process.env.TILOPAY_EXPECTED_ENVIRONMENT === "Production" && parsed.origin !== siteUrl) return null;
      return parsed.origin;
    } catch {
      // A missing or malformed platform URL must not be used for payment redirects.
    }
  }
  return null;
}
