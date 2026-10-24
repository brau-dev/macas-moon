import assert from "node:assert/strict";

// No cookies, real reservation IDs, valid booking payloads, or payment requests.
// Restricted to localhost so this check cannot accidentally target the live site.
const base = new URL(process.argv[2] ?? "http://127.0.0.1:3000");
if (base.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(base.hostname) || base.username || base.password) {
  throw new Error("Solo se permite http://localhost o http://127.0.0.1.");
}
let checks = 0;
async function request(path, status, init) {
  const response = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(15_000), ...init });
  assert.equal(response.status, status, path);
  assert.equal(response.headers.get("x-powered-by"), null, path);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", path);
  checks++;
  return response;
}
const home = await request("/", 200);
assert(!/href="\/admin(?:["/])/.test(await home.text()));
const booking = await request("/reservar", 200);
assert((await booking.text()).includes("Continuar al pago seguro"), "Compila con NEXT_PUBLIC_BOOKING_TEST_MODE=false para esta comprobación de pago.");
await request("/admin", 307);
const login = await request("/admin/login", 200);
assert.match(login.headers.get("cache-control") ?? "", /no-store/);
assert.equal(login.headers.get("referrer-policy"), "no-referrer");
assert.match(login.headers.get("x-robots-tag") ?? "", /noindex/);
for (const path of ["/api/admin/calendar", "/api/reservations/not-a-uuid", "/.env.netlify", "/.env.local", "/db/001_reservations.sql", "/db/004_admin_cancellations.sql", "/db/005_payment_link_resolution.sql", "/db/006_payment_environment.sql", "/db/007_nightly_prices.sql", "/db/008_payment_issue_resolutions.sql", "/db/009_payment_link_deadline.sql", "/db/010_payment_verification_evidence.sql", "/docs/README.md", "/docs/configuracion-y-deploy.md", "/docs/operacion.md"]) {
  await request(path, path.includes("admin/calendar") ? 401 : path.includes("not-a-uuid") ? 400 : 404);
}
for (const method of ["PUT", "DELETE"]) {
  await request("/api/admin/prices", 401, { method, headers: { origin: base.origin, "Content-Type": "application/json" }, body: "{}" });
  await request("/api/admin/prices", 403, { method, headers: { origin: "https://attacker.invalid", "Content-Type": "application/json" }, body: "{}" });
}
for (const [origin, status] of [[base.origin, 401], ["https://attacker.invalid", 403]]) {
  await request("/api/admin/reservations/00000000-0000-4000-8000-000000000099", status, {
    method: "POST", headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "resolve-payment-issue", acknowledged: true }),
  });
}
const pricing = await request("/api/pricing", 200);
assert.match(pricing.headers.get("cache-control") ?? "", /no-store/);
const values = await pricing.json();
assert.equal(values.currency, "USD");
assert(Object.values(values.perNight).length > 0 && Object.values(values.perNight).every((value) => Number.isSafeInteger(value) && value > 0), "Las tarifas deben ser enteros positivos en centavos.");
for (const [origin, body, status] of [["https://attacker.invalid", "{}", 403], [base.origin, "[]", 400], [base.origin, " ".repeat(10_001), 413]]) {
  await request("/api/reservations", status, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body });
}
console.log(`${checks} comprobaciones HTTP correctas; sin reservas, pagos ni consultas de datos personales.`);
