import { timingSafeEqual } from "node:crypto";

function isAllowedOrigin(requestOrigin: string) {
  try {
    const request = new URL(requestOrigin);
    if (request.origin !== requestOrigin) return false;

    if (process.env.NODE_ENV === "development") {
      return request.protocol === "http:" &&
        (request.hostname === "localhost" || request.hostname === "127.0.0.1");
    }

    const stagingUrl = new URL(process.env.URL ?? "");
    return process.env.NEXT_PUBLIC_BOOKING_TEST_MODE === "true" &&
      Boolean(process.env.SITE_ID) &&
      request.protocol === "https:" &&
      stagingUrl.protocol === "https:" &&
      stagingUrl.hostname.endsWith(".netlify.app") &&
      request.origin === stagingUrl.origin;
  } catch {
    return false;
  }
}

export function testSecretAuthorized(requestOrigin: string, supplied: string | null) {
  const expected = process.env.BOOKING_TEST_SECRET;
  if (!isAllowedOrigin(requestOrigin) || !expected || !/^[A-Za-z0-9_-]{24,}$/.test(expected) ||
    supplied === null || !/^[A-Za-z0-9_-]+$/.test(supplied) || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}
