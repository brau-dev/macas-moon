import { readFileSync } from "node:fs";
import { parseBookingEnv, validateBookingEnv, comparePublishedPricing } from "./booking-env.mjs";

// Public GETs only: pricing and each active dome's export. The exports read the
// database but do not create/change bookings or query private guest endpoints.
async function main() {
  const parsed = parseBookingEnv(readFileSync(".env.netlify", "utf8"));
  const errors = [...parsed.errors, ...validateBookingEnv(parsed.values).errors];
  if (errors.length) throw new Error("Primero corrige la configuración local con npm run check:netlify-env.");
  const target = new URL(process.argv[2] ?? "https://macasmoon-reservas-testing.netlify.app");
  if (target.protocol !== "https:" || target.username || target.password || target.port ||
      target.search || target.hash || target.pathname !== "/") {
    throw new Error("Indica solo la dirección HTTPS pública del sitio, sin rutas ni parámetros.");
  }
  const response = await fetch(new URL("/api/pricing", target), {
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`El sitio no publica tarifas disponibles (HTTP ${response.status}).`);
  const differences = comparePublishedPricing(parsed.values, await response.json());
  if (differences.length) {
    for (const difference of differences) console.error("- " + difference);
    throw new Error("Actualiza las variables en Netlify y publica el deploy correcto. Un push no importa .env.netlify.");
  }
  console.log("Los domos habilitados, la moneda y los precios publicados coinciden con .env.netlify.");
  for (const dome of ["domo-amplio", "domo-romantico"]) {
    const calendar = await fetch(new URL(`/api/calendar/${dome}/calendar.ics`, target), {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    });
    if (!calendar.ok) throw new Error(`Calendario ${dome}: HTTP ${calendar.status}. Airbnb y Expedia necesitan una respuesta 200.`);
    if (!(calendar.headers.get("content-type") ?? "").toLowerCase().startsWith("text/calendar")) {
      throw new Error(`Calendario ${dome}: no responde como text/calendar. Revisa que no haya protección de acceso en el proyecto.`);
    }
    const text = await calendar.text();
    if (text.length > 2_000_000 || !text.startsWith("BEGIN:VCALENDAR\r\n") || !text.endsWith("END:VCALENDAR\r\n")) {
      throw new Error(`Calendario ${dome}: no devuelve el archivo iCal esperado.`);
    }
    console.log(`Calendario ${dome}: HTTP 200, archivo iCal disponible sin iniciar sesión.`);
  }
  console.log("Esto no verifica pagos, correos ni la importación en cada plataforma; no se modificó ninguna reserva.");
}

try { await main(); }
catch (error) {
  // Do not print raw network/JSON errors, response bodies or private URLs.
  const safe = error instanceof Error && (error.message.startsWith("Primero corrige") ||
    error.message.startsWith("Indica solo") || error.message.startsWith("El sitio no publica") ||
    error.message.startsWith("Actualiza las variables") || /^Calendario domo-(amplio|romantico):/.test(error.message));
  console.error(safe ? error.message : "No se pudo comprobar el sitio. Revisa el archivo local y la conexión de red; no se mostraron datos privados.");
  process.exitCode = 1;
}
