import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const requiredKeys = [
  "BOOKING_ACTIVE_DOMES",
  "BOOKING_ENABLED",
  "BOOKING_CURRENCY",
  "PRICE_DOMO_AMPLIO_CENTS",
  "NEXT_PUBLIC_BOOKING_TEST_MODE",
  "BOOKING_TEST_SECRET",
  "ICAL_DOMO_AMPLIO_AIRBNB_URL",
  "ICAL_DOMO_AMPLIO_EXPEDIA_URL",
  "TILOPAY_CHECKOUT_ENABLED",
  "BOOKING_RECONCILE_ENABLED",
];
const optionalKeys = ["PRICE_DOMO_ROMANTICO_CENTS"];
const feedKeys = [
  "ICAL_DOMO_AMPLIO_AIRBNB_URL",
  "ICAL_DOMO_AMPLIO_EXPEDIA_URL",
];
const args = process.argv.slice(2);
const file = resolve(args.find((arg) => !arg.startsWith("--")) ?? ".env.netlify");
const fetchFeeds = args.includes("--fetch");
const errors = [];
const values = new Map();

try {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) { errors.push(`Línea ${index + 1}: usa NOMBRE=valor, sin espacios alrededor del signo igual.`); continue; }
    const [, key, value] = match;
    if (values.has(key)) errors.push(`La variable ${key} está repetida.`);
    values.set(key, value.trim());
  }
} catch {
  errors.push("No se pudo abrir .env.netlify. Crea o localiza el archivo antes de continuar.");
}

for (const key of requiredKeys) {
  if (!values.has(key)) errors.push(`Falta ${key}.`);
}
for (const key of values.keys()) {
  if (![...requiredKeys, ...optionalKeys].includes(key)) {
    errors.push(`La variable ${key} no pertenece a la prueba del domo amplio; revisa antes de importarla.`);
  }
}
for (const [key, expected] of [
  ["BOOKING_ACTIVE_DOMES", "domo-amplio"],
  ["BOOKING_ENABLED", "true"],
  ["NEXT_PUBLIC_BOOKING_TEST_MODE", "true"],
  ["TILOPAY_CHECKOUT_ENABLED", "false"],
  ["BOOKING_RECONCILE_ENABLED", "false"],
]) {
  if (values.has(key) && values.get(key) !== expected) errors.push(`${key} debe ser ${expected}.`);
}
const currency = values.get("BOOKING_CURRENCY");
if (currency !== undefined && !/^[A-Z]{3}$/.test(currency)) {
  errors.push("BOOKING_CURRENCY debe contener tres letras mayúsculas, por ejemplo USD.");
}
for (const key of ["PRICE_DOMO_AMPLIO_CENTS", ...optionalKeys]) {
  const value = values.get(key);
  if (value !== undefined && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) {
    errors.push(`${key} debe ser un entero positivo en centavos, sin símbolo monetario.`);
  }
}
const secret = values.get("BOOKING_TEST_SECRET");
if (secret !== undefined && !/^[A-Za-z0-9_-]{24,}$/.test(secret)) {
  errors.push("BOOKING_TEST_SECRET debe tener al menos 24 caracteres alfanuméricos, guion o guion bajo.");
}

const urls = [];
for (const key of feedKeys) {
  const value = values.get(key);
  if (value === undefined) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password ||
      url.hash || url.hostname.endsWith(".netlify.app") || url.hostname === "macasmoon.com") {
      throw new Error("URL no permitida");
    }
    urls.push(value);
  } catch {
    errors.push(`${key} debe ser el enlace HTTPS privado que exporta el anuncio correspondiente en Airbnb o Expedia.`);
  }
}
if (urls.length === feedKeys.length && new Set(urls).size !== urls.length) {
  errors.push("Los dos enlaces iCal de entrada del domo amplio deben ser diferentes.");
}

if (errors.length === 0 && fetchFeeds) {
  const checks = await Promise.all(feedKeys.map(async (key) => {
    try {
      const response = await fetch(values.get(key), {
        redirect: "error",
        headers: { Accept: "text/calendar" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) return `${key}: HTTP ${response.status}.`;
      const body = await response.text();
      if (body.length > 2_000_000 || !body.includes("BEGIN:VCALENDAR") ||
        !body.includes("END:VCALENDAR")) return `${key}: la respuesta no parece un calendario iCal válido.`;
      return null;
    } catch {
      return `${key}: no se pudo descargar en 8 segundos o el enlace redirige.`;
    }
  }));
  errors.push(...checks.filter(Boolean));
}

if (errors.length) {
  console.error("Configuración NO lista para importar o desplegar:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Configuración válida para probar solo el domo amplio: dos iCal HTTPS distintos, precio y modo sin cobro.");
  if (fetchFeeds) console.log("Los dos calendarios respondieron con contenido iCal.");
  console.log("No se mostraron claves ni enlaces privados.");
}
