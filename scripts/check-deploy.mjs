import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseBookingEnv, validateBookingEnv } from "./booking-env.mjs";

// Local checks only. The private file is passed to the build process without
// copying it into source, exposing it in arguments or loading it into tests.
let parsed;
try { parsed = parseBookingEnv(readFileSync(".env.netlify", "utf8")); }
catch { console.error("No se pudo abrir .env.netlify. No se mostraron valores privados."); process.exit(1); }
const result = validateBookingEnv(parsed.values);
const errors = [...parsed.errors, ...result.errors];
for (const warning of result.warnings) console.warn("Aviso: " + warning);
if (errors.length) {
  for (const error of errors) console.error("- " + error);
  process.exit(1);
}
if (!process.env.npm_execpath) {
  console.error("Ejecuta este comando con npm run check:deploy.");
  process.exit(1);
}
for (const task of ["test", "lint", "build", "typecheck", "audit:exposure"]) {
  console.log(`\nComprobación local: ${task}`);
  const env = task === "build" ? { ...process.env, ...Object.fromEntries(parsed.values) } : process.env;
  const child = spawnSync(process.execPath, [process.env.npm_execpath, "run", task], { env, stdio: "inherit" });
  if (child.error || child.status !== 0) {
    console.error(`Comprobación interrumpida en ${task}. No se ha realizado ningún deploy.`);
    process.exit(child.status || 1);
  }
}
console.log("\nComprobaciones locales correctas. Falta importar .env.netlify en Netlify y comprobar el deploy publicado.");
console.log("No se verificaron credenciales externas ni se realizaron reservas, cobros o envíos de correo.");
