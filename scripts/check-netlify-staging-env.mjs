import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseBookingEnv, validateBookingEnv } from "./booking-env.mjs";

const args = process.argv.slice(2);
const file = resolve(args.find((arg) => !arg.startsWith("--")) ?? ".env.netlify");
let parsed;
try { parsed = parseBookingEnv(readFileSync(file, "utf8")); }
catch { console.error("No se pudo abrir el archivo de variables. No se mostraron valores privados."); process.exit(1); }
const result = validateBookingEnv(parsed.values, { production: args.includes("--production") });
const errors = [...parsed.errors, ...result.errors];
if (!errors.length && args.includes("--fetch")) {
  const checks = await Promise.all(result.feedKeys.map(async (key) => {
    try {
      const response = await fetch(parsed.values.get(key), { redirect: "error", headers: { Accept: "text/calendar" }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) return key + ": HTTP " + response.status + ".";
      const body = await response.text();
      if (body.length > 2_000_000 || !body.includes("BEGIN:VCALENDAR") || !body.includes("END:VCALENDAR")) return key + ": no parece un calendario válido.";
      return null;
    } catch { return key + ": no se pudo descargar sin redirecciones en 8 segundos."; }
  }));
  errors.push(...checks.filter(Boolean));
}
for (const warning of result.warnings) console.warn("Aviso: " + warning);
if (errors.length) {
  console.error("Configuración NO lista para desplegar:");
  for (const error of errors) console.error("- " + error);
  process.exitCode = 1;
} else {
  console.log("Formato/configuración válidos: " + result.active.join(", ") + "; " + result.mode + ".");
  console.log("Esto no valida credenciales, modo del comercio, remitente, DNS, migraciones ni cobros reales.");
}
console.log("No se mostraron claves ni enlaces privados.");
