import { missingEmailConfig } from "../src/lib/gmail-config.mjs";

const domes = ["domo-romantico", "domo-amplio"];
const configured = (value) => typeof value === "string" && Boolean(value.trim());

export function parseBookingEnv(text) {
  const values = new Map();
  const errors = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) { errors.push(`Línea ${index + 1}: usa NOMBRE=valor.`); continue; }
    const key = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (values.has(key)) errors.push(`La variable ${key} está repetida.`);
    values.set(key, value);
  }
  return { values, errors };
}

export function validateBookingEnv(values, { production = false } = {}) {
  const errors = [];
  const warnings = [];
  const get = (key) => values.get(key);
  const requireValue = (key) => { if (!configured(get(key))) errors.push(`Falta completar ${key}.`); };
  const requireFlag = (key, expected) => { if (get(key) !== expected) errors.push(`${key} debe ser ${expected}.`); };
  const publicKeys = new Set(["NEXT_PUBLIC_BOOKING_TEST_MODE", "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "NEXT_PUBLIC_WHATSAPP_URL", "NEXT_PUBLIC_CONTACT_EMAIL", "NEXT_PUBLIC_ONLINE_BOOKING_ENABLED",
    "NEXT_PUBLIC_CLOUDBEDS_CALENDAR_ENABLED", "NEXT_PUBLIC_CLOUDBEDS_PROPERTY_CODE",
    "NEXT_PUBLIC_CLOUDBEDS_DOMO_ROMANTICO_RID", "NEXT_PUBLIC_CLOUDBEDS_DOMO_AMPLIO_RID"]);
  for (const key of values.keys()) {
    if (key.startsWith("NEXT_PUBLIC_") && !publicKeys.has(key)) errors.push(`${key} no está autorizado como variable pública. No publiques credenciales.`);
  }
  requireFlag("BOOKING_ENABLED", "true");
  for (const key of ["NEXT_PUBLIC_BOOKING_TEST_MODE", "TILOPAY_CHECKOUT_ENABLED", "BOOKING_RECONCILE_ENABLED"]) {
    if (!["true", "false"].includes(get(key))) errors.push(`${key} debe ser true o false.`);
  }
  const active = (get("BOOKING_ACTIVE_DOMES") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!active.length || new Set(active).size !== active.length || active.some((value) => !domes.includes(value))) {
    errors.push("BOOKING_ACTIVE_DOMES debe contener domo-amplio, domo-romantico o ambos, sin repetidos.");
  }
  if (!/^[A-Z]{3}$/.test(get("BOOKING_CURRENCY") ?? "")) errors.push("BOOKING_CURRENCY debe ser un código de tres letras, por ejemplo USD.");
  const feedKeys = [];
  const allFeeds = new Set();
  for (const dome of active.filter((value) => domes.includes(value))) {
    const label = dome === "domo-amplio" ? "AMPLIO" : "ROMANTICO";
    const key = `PRICE_DOMO_${label}_CENTS`;
    if (!/^[1-9]\d*$/.test(get(key) ?? "") || !Number.isSafeInteger(Number(get(key))) || Number(get(key)) > Math.floor(2147483647 / 30)) {
      errors.push(`${key} debe ser un entero positivo en centavos, compatible con estadías de hasta 30 noches.`);
    }
    if (Number(get(key)) === 1) warnings.push(`${key}=1: tarifa de prueba; restaura la tarifa real antes de abrir al público.`);
    const urls = [];
    for (const channel of ["AIRBNB", "EXPEDIA"]) {
      const feedKey = `ICAL_DOMO_${label}_${channel}_URL`;
      feedKeys.push(feedKey);
      requireValue(feedKey);
      if (!configured(get(feedKey))) continue;
      try {
        const url = new URL(get(feedKey));
        if (url.protocol !== "https:" || url.username || url.password || url.hash ||
          url.hostname.endsWith(".netlify.app") || /(^|\.)macasmoon\.com$/.test(url.hostname)) throw new Error();
        urls.push(url.href);
        if (allFeeds.has(url.href)) errors.push(`${feedKey} repite otro calendario: cada anuncio/domo requiere su enlace correcto.`);
        allFeeds.add(url.href);
      } catch { errors.push(`${feedKey} debe ser el enlace HTTPS privado exportado por el anuncio correspondiente.`); }
    }
    if (urls.length === 2 && urls[0] === urls[1]) errors.push(`Los dos iCal de ${dome} deben ser distintos.`);
  }
  const freeTest = get("NEXT_PUBLIC_BOOKING_TEST_MODE") === "true";
  if (freeTest) {
    requireFlag("TILOPAY_CHECKOUT_ENABLED", "false");
    requireFlag("BOOKING_RECONCILE_ENABLED", "false");
    if (!/^[A-Za-z0-9_-]{24,}$/.test(get("BOOKING_TEST_SECRET") ?? "")) errors.push("BOOKING_TEST_SECRET debe tener al menos 24 caracteres seguros.");
    if (production) errors.push("Producción no puede habilitar reservas gratuitas de prueba.");
  } else {
    requireFlag("TILOPAY_CHECKOUT_ENABLED", "true");
    for (const key of ["TILOPAY_API_USER", "TILOPAY_API_PASSWORD", "TILOPAY_API_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
      "TURNSTILE_SECRET_KEY", "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH"]) requireValue(key);
    for (const key of missingEmailConfig(Object.fromEntries(values))) errors.push(`${key}: configura Gmail y su contraseña de aplicación de 16 caracteres (no tu contraseña normal).`);
    if (!["Test", "Production"].includes(get("TILOPAY_EXPECTED_ENVIRONMENT"))) errors.push("TILOPAY_EXPECTED_ENVIRONMENT debe ser Test o Production.");
    if (production && get("TILOPAY_EXPECTED_ENVIRONMENT") !== "Production") errors.push("Producción requiere TILOPAY_EXPECTED_ENVIRONMENT=Production y una cuenta de comercio en ese modo.");
    if (get("BOOKING_RECONCILE_ENABLED") !== "true") warnings.push("La conciliación de respaldo está apagada; webhook/retorno no sustituyen todos los reintentos.");
    if (get("BOOKING_REPLY_TO") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("BOOKING_REPLY_TO"))) errors.push("BOOKING_REPLY_TO debe ser un correo válido.");
  }
  const hasAdmin = configured(get("ADMIN_USERNAME")) || configured(get("ADMIN_PASSWORD_HASH"));
  if (hasAdmin) {
    requireValue("ADMIN_USERNAME"); requireValue("ADMIN_PASSWORD_HASH");
    if (get("ADMIN_USERNAME") && !/^[A-Za-z0-9._-]{3,80}$/.test(get("ADMIN_USERNAME"))) errors.push("ADMIN_USERNAME debe tener 3 a 80 caracteres: letras, números, punto, guion o guion bajo.");
    if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(get("ADMIN_PASSWORD_HASH") ?? "")) errors.push("Genera ADMIN_PASSWORD_HASH con npm run admin:password; no uses la contraseña en texto plano.");
  }
  if (get("BOOKING_RECONCILE_ENABLED") === "true" && !/^[A-Za-z0-9_-]{32,}$/.test(get("BOOKING_RECONCILE_SECRET") ?? "")) {
    errors.push("BOOKING_RECONCILE_SECRET debe ser una clave nueva de al menos 32 caracteres; genera con openssl rand -hex 32.");
  }
  if (production && configured(get("BOOKING_TEST_SECRET"))) errors.push("Elimina BOOKING_TEST_SECRET del archivo de producción.");
  if (!configured(get("NETLIFY_DB_URL")) && !configured(get("DATABASE_URL"))) warnings.push("La conexión no está en este archivo: Netlify debe proporcionar NETLIFY_DB_URL y aplicar las migraciones. No se ha comprobado la base.");
  return { errors, warnings, active, feedKeys, mode: freeTest ? "sin cobro" : `pagos ${get("TILOPAY_EXPECTED_ENVIRONMENT") ?? "sin entorno"}` };
}

// Compare only public configuration. Never include private environment values or
// arbitrary response text in diagnostics from the published site.
export function comparePublishedPricing(values, published) {
  if (!published || typeof published !== "object" || Array.isArray(published) ||
      !published.perNight || typeof published.perNight !== "object" || Array.isArray(published.perNight)) {
    return ["El sitio no devuelve tarifas válidas."];
  }
  const errors = [];
  if (published.currency !== values.get("BOOKING_CURRENCY")) errors.push("BOOKING_CURRENCY no coincide con la configuración local.");
  const active = (values.get("BOOKING_ACTIVE_DOMES") ?? "").split(",").map((value) => value.trim());
  for (const dome of domes) {
    if (!active.includes(dome)) {
      if (Object.hasOwn(published.perNight, dome)) errors.push(`${dome}: sigue habilitado en el sitio aunque está desactivado localmente.`);
      continue;
    }
    const key = dome === "domo-amplio" ? "PRICE_DOMO_AMPLIO_CENTS" : "PRICE_DOMO_ROMANTICO_CENTS";
    if (!Object.hasOwn(published.perNight, dome)) errors.push(`${dome}: no está habilitado en el sitio publicado. Revisa BOOKING_ACTIVE_DOMES en Netlify.`);
    else if (published.perNight[dome] !== Number(values.get(key))) errors.push(`${key}: el precio publicado no coincide con el archivo local.`);
  }
  if (Object.keys(published.perNight).some((key) => !domes.includes(key))) errors.push("El sitio devuelve un alojamiento no reconocido.");
  return errors;
}
