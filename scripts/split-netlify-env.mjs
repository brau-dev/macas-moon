import { readFileSync, writeFileSync, chmodSync, lstatSync, existsSync, constants } from "node:fs";
import { parseBookingEnv, validateBookingEnv } from "./booking-env.mjs";
import { splitNetlifyEnv, classifyNetlifyEnv } from "./netlify-env-policy.mjs";

// Mechanical generation of ignored import files, never a remote Netlify change.
try {
  const { values, errors } = parseBookingEnv(readFileSync(".env.netlify", "utf8"));
  if (errors.length || validateBookingEnv(values).errors.length) throw new Error("Invalid source configuration");
  const split = splitNetlifyEnv(values);
  const files = [[".env.netlify.sin-secretos", split.nonSecret], [".env.netlify.secretos", split.secret]];
  // Validate every target before replacing either generated file.
  for (const [file] of files) {
    if (existsSync(file)) {
      const stat = lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error("Unsafe output path");
    }
  }
  for (const [file, body] of files) {
    if (existsSync(file)) chmodSync(file, 0o600);
    writeFileSync(file, body, { mode: 0o600, flag: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW });
    chmodSync(file, 0o600);
  }
  const groups = classifyNetlifyEnv(values);
  console.log(`.env.netlify.sin-secretos: ${groups.nonSecret.length} variables; importar SIN marcar secretos (Builds + Functions).`);
  console.log(`.env.netlify.secretos: ${groups.secret.length} variables; importar CON secretos (Functions).`);
  console.log("Mismos valores que .env.netlify, sin mostrarlos. Ambos archivos tienen permisos 600 y no deben subirse a Git.");
} catch {
  console.error("No se pudieron generar los archivos. Revisa npm run check:netlify-env y que los destinos sean archivos normales. No se mostraron valores privados.");
  process.exitCode = 1;
}
