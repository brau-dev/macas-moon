// The API reference uses app.tilopay.com; the live API also returns tilo.co.
// Official support: https://support.tilopay.com/portal/es/kb/articles/crear-un-link-de-pago
// Keep this exact allowlist: do not accept arbitrary domains or substring matches.
const paymentHosts = new Set(["app.tilopay.com", "admin.tilopay.com", "tilo.co"]);

export function trustedTilopayPaymentUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 4096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !paymentHosts.has(url.hostname) ||
      url.username || url.password || url.port) return null;
    return url.toString();
  } catch { return null; }
}
