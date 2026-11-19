import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parseBookingEnv, validateBookingEnv } from "./booking-env.mjs";
import { netlifyNonSecretKeys } from "./netlify-env-policy.mjs";

// Model the Netlify build scope. The master supplies public configuration for
// compilation and known credentials for the post-build exposure audit.
let parsed;
try { parsed = parseBookingEnv(readFileSync(".env.netlify", "utf8")); }
catch { console.error("No se pudo abrir .env.netlify. No se mostraron valores privados."); process.exit(1); }
const result = validateBookingEnv(parsed.values, { production: process.argv.includes("--production") });
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
const buildValues = [...parsed.values].filter(([key]) => netlifyNonSecretKeys.includes(key));
for (const task of ["env:split", "test", "lint", "build", "typecheck", "audit:exposure"]) {
  console.log(`\nComprobación local: ${task}`);
  const env = task === "build" ? { ...process.env, ...Object.fromEntries(buildValues) } : process.env;
  const child = spawnSync(process.execPath, [process.env.npm_execpath, "run", task], { env, stdio: "inherit" });
  if (child.error || child.status !== 0) {
    console.error(`Comprobación interrumpida en ${task}. No se ha realizado ningún deploy.`);
    process.exit(child.status || 1);
  }
}
console.log("\nComprobaciones locales correctas. Importa .env.netlify.sin-secretos y .env.netlify.secretos por separado y comprueba el deploy publicado.");
console.log("No se verificaron credenciales externas ni se realizaron reservas, cobros o envíos de correo.");
console.log("Clasificación de variables: npm run check:netlify-env -- --classify. Revisa Contains secret values en Netlify antes de publicar.");
