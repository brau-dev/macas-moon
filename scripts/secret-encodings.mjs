// Match Netlify's documented threshold (>4 characters), including short API
// credentials. Never log these strings; callers report names/paths only.
export const minimumSecretLength = 5;

export function configuredSecretEncodings(value) {
  if (typeof value !== "string" || value.length < minimumSecretLength) return [];
  return [...new Set([value, encodeURIComponent(value), Buffer.from(value, "utf8").toString("base64")])];
}
