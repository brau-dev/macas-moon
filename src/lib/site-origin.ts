// Netlify supplies URL automatically for both builds and Functions.
// Local development does not need a public URL for no-payment tests.
export function getSiteOrigin() {
  const value = process.env.URL;
  if (value) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol === "https:") return parsed.origin;
    } catch {
      // A missing or malformed platform URL must not be used for payment redirects.
    }
  }
  return null;
}
