// Classification is about credentials, not whether a variable runs in the browser.
// Non-secret server settings still need the Functions scope on Netlify.
export const netlifyNonSecretKeys = [
  "BOOKING_ACTIVE_DOMES", "BOOKING_ENABLED", "BOOKING_CURRENCY",
  "PRICE_DOMO_ROMANTICO_CENTS", "PRICE_DOMO_AMPLIO_CENTS",
  "NEXT_PUBLIC_BOOKING_TEST_MODE", "TILOPAY_CHECKOUT_ENABLED",
  "BOOKING_RECONCILE_ENABLED", "TILOPAY_EXPECTED_ENVIRONMENT",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "SMTP_USER", "BOOKING_REPLY_TO", "ADMIN_USERNAME",
  "TILOPAY_MERCHANT_ID",
  // Optional public contact and legacy integrations, not required by /reservar.
  "NEXT_PUBLIC_WHATSAPP_URL", "NEXT_PUBLIC_CONTACT_EMAIL", "NEXT_PUBLIC_ONLINE_BOOKING_ENABLED",
  "NEXT_PUBLIC_CLOUDBEDS_CALENDAR_ENABLED", "NEXT_PUBLIC_CLOUDBEDS_PROPERTY_CODE",
  "NEXT_PUBLIC_CLOUDBEDS_DOMO_ROMANTICO_RID", "NEXT_PUBLIC_CLOUDBEDS_DOMO_AMPLIO_RID",
];

export const netlifySecretKeys = [
  "ICAL_DOMO_ROMANTICO_AIRBNB_URL", "ICAL_DOMO_ROMANTICO_EXPEDIA_URL",
  "ICAL_DOMO_AMPLIO_AIRBNB_URL", "ICAL_DOMO_AMPLIO_EXPEDIA_URL",
  "TILOPAY_API_USER", "TILOPAY_API_PASSWORD", "TILOPAY_API_KEY",
  "TURNSTILE_SECRET_KEY", "SMTP_PASSWORD", "ADMIN_PASSWORD_HASH", "BOOKING_RECONCILE_SECRET",
  // Optional local/external database or deliberately enabled free-testing mode.
  "DATABASE_URL", "BOOKING_TEST_SECRET",
];

export const netlifyManagedKeys = ["URL", "SITE_ID", "NETLIFY_DB_URL", "NODE_VERSION",
  "SECRETS_SCAN_OMIT_KEYS", "SECRETS_SCAN_OMIT_PATHS", "SECRETS_SCAN_ENABLED"];

export function classifyNetlifyEnv(values) {
  const keys = [...values.keys()];
  return {
    nonSecret: keys.filter((key) => netlifyNonSecretKeys.includes(key)),
    secret: keys.filter((key) => netlifySecretKeys.includes(key)),
    managed: keys.filter((key) => netlifyManagedKeys.includes(key)),
    unknown: keys.filter((key) => !netlifyNonSecretKeys.includes(key) && !netlifySecretKeys.includes(key) && !netlifyManagedKeys.includes(key)),
  };
}

function quoteEnvValue(value) {
  if (/[\r\n\0]/.test(value)) throw new Error("No se admiten valores de varias líneas.");
  if (!/[\s#]/.test(value)) return value;
  if (/["\\]/.test(value)) throw new Error("Un valor necesita revisión manual de formato.");
  return `"${value}"`;
}

// Generate two non-overlapping imports. Never include credentials in the public
// batch or platform-managed variables in either batch. Preserve values exactly.
export function splitNetlifyEnv(values) {
  const groups = classifyNetlifyEnv(values);
  if (groups.unknown.length || groups.managed.length) throw new Error("Hay variables sin clasificar o administradas por Netlify.");
  const section = (keys, header) => [header, ...keys.filter((key) => values.has(key))
    .map((key) => `${key}=${quoteEnvValue(values.get(key))}`), ""].join("\n");
  return {
    nonSecret: section(netlifyNonSecretKeys, "# Importar SIN Contains secret values. Alcances: Builds + Functions."),
    secret: section(netlifySecretKeys, "# PRIVADO. Importar CON Contains secret values. Alcance: Functions. No subir a Git."),
  };
}
