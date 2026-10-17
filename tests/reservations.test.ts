import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Module } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { hashAdminPassword, verifyAdminPassword } from "../src/lib/admin-password.mjs";
import type { AdminReservation } from "../src/lib/admin-calendar-view";

test("fonts are bundled with their licenses and never require the Google font loader", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  assert(layout.includes('from "next/font/local"'));
  assert(!layout.includes("next/font/google"));
  for (const [name, hash] of [
    ["Lora", "822a6621ccbe8d97d20ac88c1c41f5615c9c2c202eaa75f272cd452aac6475a7"],
    ["NunitoSans", "f934d7142fb4784bf828da485b7dcbd90c0c80d514e9d49a5da0ed3a1ae2491d"],
  ]) {
    const path = `./fonts/${name}-Variable.ttf`;
    assert(layout.includes(path));
    const font = readFileSync(`src/app/${path}`);
    assert.equal(font.readUInt32BE(0), 0x00010000, "Expected a TrueType font, not a downloaded HTML error page.");
    assert.equal(createHash("sha256").update(font).digest("hex"), hash);
    const license = readFileSync(`src/app/fonts/${name}-OFL.txt`, "utf8");
    assert(license.startsWith("Copyright"));
    assert(license.includes("SIL OPEN FONT LICENSE Version 1.1"));
  }
});

function adminReservationFixture(change: Partial<AdminReservation> = {}): AdminReservation {
  return { id: "00000000-0000-4000-8000-000000000099", dome: "domo-amplio",
    checkIn: "2031-06-01", checkOut: "2031-06-03", kind: "booking", status: "confirmed",
    name: "Fixture Guest", email: "guest@example.com", phone: "+50688888888", country: "CR", guests: 2,
    amountCents: 34000, currency: "USD", provider: "tilopay", note: "", expiresAt: null,
    paymentEnvironment: "Test",
    emailSent: true, ownerEmailRequired: true, ownerEmailSent: true, paymentIssue: null,
    cancelledAt: null, cancelledBy: null, cancellationReason: null, cancelledFrom: null,
    cancellationStart: null, cancellationEnd: null, parentBlockId: null, paymentLinkPending: false,
    paymentLinkState: null, paymentLinkCheckedAt: null, paymentLinkDiagnostic: null,
    ...change };
}

// SQL runs against disposable in-memory PostgreSQL. All HTTP calls are fixtures.
// No .env files are loaded, no real calendars are read, and no payments are sent.
test("reservations, payments, iCal and private administration", async (t) => {
  // Next's compiler enforces server-only imports. These tests run server modules
  // directly in Node, outside that compiler, with all providers simulated.
  const markerPath = require.resolve("server-only");
  const oldMarker = require.cache[markerPath];
  const marker = new Module(markerPath);
  marker.loaded = true;
  require.cache[markerPath] = marker;
  const sql = await PGlite.create();
  await sql.exec(readFileSync("db/001_reservations.sql", "utf8"));
  const upgrade = readFileSync("db/002_admin_and_payment_links.sql", "utf8");
  await sql.exec(upgrade);
  await sql.exec(upgrade); // Migration can safely be reapplied manually.
  assert.equal(upgrade, readFileSync("netlify/database/migrations/0002_admin_and_payment_links.sql", "utf8"));
  // A reservation that predates owner notifications must not trigger a new-owner alert.
  const legacyId = "00000000-0000-4000-8000-000000000001";
  await sql.query(`INSERT INTO reservations (id,dome,check_in,check_out,guests,guest_name,
    guest_email,guest_phone,billing_country,status,amount_cents,currency,payment_provider)
    VALUES ($1,'domo-amplio','2028-01-01','2028-01-02',1,'Legacy','legacy@example.com','123','CR','confirmed',0,'USD','test')`, [legacyId]);
  const notifications = readFileSync("db/003_owner_notifications.sql", "utf8");
  await sql.exec(notifications);
  await sql.exec(notifications);
  assert.equal(notifications, readFileSync("netlify/database/migrations/0003_owner_notifications.sql", "utf8"));
  assert.equal((await sql.query<{ owner_notification_required: boolean }>("SELECT owner_notification_required FROM reservations WHERE id = $1", [legacyId])).rows[0].owner_notification_required, false);
  const cancellations = readFileSync("db/004_admin_cancellations.sql", "utf8");
  await sql.exec(cancellations);
  await sql.exec(cancellations);
  assert.equal(cancellations, readFileSync("netlify/database/migrations/0004_admin_cancellations.sql", "utf8"));
  const linkResolution = readFileSync("db/005_payment_link_resolution.sql", "utf8");
  await sql.exec(linkResolution);
  await sql.exec(linkResolution);
  assert.equal(linkResolution, readFileSync("netlify/database/migrations/0005_payment_link_resolution.sql", "utf8"));
  const environments = readFileSync("db/006_payment_environment.sql", "utf8");
  await sql.exec(environments); await sql.exec(environments);
  assert.equal(environments, readFileSync("netlify/database/migrations/0006_payment_environment.sql", "utf8"));
  assert.equal((await sql.query<{ payment_environment: string }>("SELECT payment_environment FROM reservations WHERE id=$1", [legacyId])).rows[0].payment_environment, "Test");
  const nightlyPrices = readFileSync("db/007_nightly_prices.sql", "utf8");
  await sql.exec(nightlyPrices); await sql.exec(nightlyPrices);
  assert.equal(nightlyPrices, readFileSync("netlify/database/migrations/0007_nightly_prices.sql", "utf8"));

  let queue = Promise.resolve();
  let failBookingRead = false;
  let failSplitInsert = false;
  let failPriceRead = false;
  let failPriceWrite = false;
  const executedSql: string[] = [];
  let poolOptions: Record<string, unknown> = {};
  let idleErrorHandler: ((error: Error) => void) | undefined;
  async function acquire() {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    return release;
  }
  const query = async (text: string, args?: unknown[]) => {
    executedSql.push(text);
    if (failPriceRead && text.includes("FROM nightly_prices")) {
      failPriceRead = false;
      throw new Error("Fixture private price database failure");
    }
    if (failSplitInsert && /^INSERT INTO reservations/.test(text) && text.includes("parent_block_id")) {
      failSplitInsert = false;
      throw new Error("Fixture: could not preserve the remaining block");
    }
    const result = await sql.query(text, args);
    if (failPriceWrite && text.includes("INSERT INTO nightly_prices")) {
      failPriceWrite = false;
      throw new Error("Fixture rate write failure after SQL");
    }
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  class TestPool {
    constructor(options: Record<string, unknown>) { poolOptions = options; }
    on(event: string, handler: (error: Error) => void) { if (event === "error") idleErrorHandler = handler; }
    async query(text: string, args?: unknown[]) {
      if (failBookingRead && text.startsWith("SELECT id, dome, check_in::text")) {
        failBookingRead = false;
        throw new Error("Private database failure guest@example.com");
      }
      const release = await acquire();
      try { return await query(text, args); } finally { release(); }
    }
    async connect() {
      const release = await acquire();
      return { query, release };
    }
  }
  // tsx transpiles this project as CommonJS; patch the driver before loading services.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pg = require("pg");
  const OriginalPool = pg.Pool;
  pg.Pool = TestPool;
  const cookieValues = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nextHeaders = require("next/headers");
  const originalCookies = nextHeaders.cookies;
  nextHeaders.cookies = async () => ({ get: (name: string) => cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined });

  Object.assign(process.env, { NODE_ENV: "development", DATABASE_URL: "postgresql://fake/in-memory-only",
    BOOKING_ENABLED: "true", BOOKING_ACTIVE_DOMES: "domo-amplio", BOOKING_CURRENCY: "USD",
    PRICE_DOMO_AMPLIO_CENTS: "12500", NEXT_PUBLIC_BOOKING_TEST_MODE: "true",
    BOOKING_TEST_SECRET: "testing_only_not_a_real_secret_123456", TILOPAY_CHECKOUT_ENABLED: "true",
    TILOPAY_API_USER: "fixture", TILOPAY_API_PASSWORD: "fixture", TILOPAY_API_KEY: "fixture",
    TILOPAY_EXPECTED_ENVIRONMENT: "Test", TURNSTILE_SECRET_KEY: "fixture", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "fixture",
    URL: "https://fixture.netlify.app", SMTP_USER: "fixture@gmail.com", SMTP_PASSWORD: "abcdefghijklmnop",
    ADMIN_USERNAME: "owner", ICAL_DOMO_AMPLIO_AIRBNB_URL: "https://airbnb.example/calendar.ics",
    ICAL_DOMO_AMPLIO_EXPEDIA_URL: "https://expedia.example/calendar.ics",
    ICAL_DOMO_ROMANTICO_AIRBNB_URL: "https://airbnb.example/romantico.ics",
    ICAL_DOMO_ROMANTICO_EXPEDIA_URL: "https://expedia.example/romantico.ics" });
  delete process.env.NETLIFY_DB_URL;
  delete process.env.SITE_ID;
  delete process.env.TILOPAY_MERCHANT_ID;
  process.env.ADMIN_PASSWORD_HASH = await hashAdminPassword("A-private-test-password!");

  const emptyIcs = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n";
  let feedFailure = false;
  let feedEvent = "";
  const domeFeedEvents = new Map<string, string>();
  let nextLinkId = 10;
  type Link = { reference: string; amount: string; currency: string; order: string; approved: boolean; environment: string };
  const links = new Map<string, Link>();
  let paymentBody: Record<string, unknown> | null = null;
  let createdPayments = 0;
  let detailCalls = 0;
  let closedLinks = 0;
  let closeLinkFailure = false;
  let closeFixture: "normal" | "numeric" | "status-zero" | "http" | "timeout" = "normal";
  let linkTypeFixture: string | number | undefined;
  let loginCalls = 0;
  let authFixture: "success" | "http" | "missing_token" = "success";
  let linkFixture: "success" | "http" | "reject" | "bad_json" | "unsafe_url" |
    "missing_id" | "timeout" | "connection" = "success";
  let detailFixture: "live" | "legacy" | "wrong_reference" | "missing_id" | "invalid_date" = "live";
  let transactionFixture: "success" | "unrelated" | "wrong_amount" | "wrong_currency" |
    "wrong_environment" | "wrong_capture" | "duplicate" | "invalid_response" = "success";
  let wrongConsultId = false;
  const transactionRequests: Array<Record<string, unknown>> = [];
  let emailCalls = 0;
  let smtpFailure = false;
  let smtpFailedAudience: "guest" | "owner" | null = null;
  const sentEmails: Array<Record<string, unknown>> = [];
  let smtpOptions: Record<string, unknown> | null = null;
  let lastEmail: Record<string, unknown> | null = null;
  // Patch before importing the mailer: tests must never connect to a real SMTP service.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodemailer = require("nodemailer");
  const originalTransport = nodemailer.createTransport;
  nodemailer.createTransport = (options: Record<string, unknown>) => {
    smtpOptions = options;
    return { close() {}, async sendMail(message: Record<string, unknown>) {
      emailCalls++; lastEmail = message; sentEmails.push(message);
      const recipient = (message.to as { address: string }).address;
      const audience = recipient === "fixture@gmail.com" ? "owner" : "guest";
      if (smtpFailure || smtpFailedAudience === audience) throw new Error("SMTP fixture failure; do not log credentials");
      return { accepted: [recipient], rejected: [] };
    } };
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://airbnb.example") || url.startsWith("https://expedia.example")) {
      if (feedFailure && url.startsWith("https://expedia")) return new Response(null, { status: 503 });
      const event = domeFeedEvents.get(url.includes("romantico") ? "domo-romantico" : "domo-amplio") ?? feedEvent;
      return new Response(event ? `BEGIN:VCALENDAR\r\n${event}\r\nEND:VCALENDAR\r\n` : emptyIcs);
    }
    if (url.includes("challenges.cloudflare.com")) return Response.json({ success: true, hostname: "fixture.netlify.app", action: "booking" });
    if (url.endsWith("/login")) {
      loginCalls++;
      if (authFixture === "http") return new Response("Private API password", { status: 401 });
      if (authFixture === "missing_token") return Response.json({ type: "401", message: "Private API password" });
      return Response.json({ access_token: "fixture-token", expires_in: 3600 });
    }
    if (url.endsWith("/createLinkPayment")) {
      if (linkFixture === "http") return new Response("Private provider body fixture-password", { status: 403 });
      if (linkFixture === "reject") return Response.json({ type: "422", message: "Private provider body fixture-password" });
      if (linkFixture === "bad_json") return new Response("Private provider body fixture-password");
      if (linkFixture === "timeout") throw new DOMException("Private timeout", "TimeoutError");
      if (linkFixture === "connection") throw new TypeError("fetch failed", { cause: Object.assign(new Error("Private merchant URL"), { code: "ECONNRESET" }) });
      paymentBody = JSON.parse(String(init?.body));
      createdPayments++;
      const id = String(nextLinkId++);
      links.set(id, { reference: String(paymentBody!.reference), amount: String(paymentBody!.amount),
        currency: String(paymentBody!.currency), order: `TPT${id}`, approved: false, environment: process.env.TILOPAY_EXPECTED_ENVIRONMENT! });
      return Response.json({ type: "200", url: linkFixture === "unsafe_url"
        ? `https://tilo.co.attacker.example/link/${id}` : `https://tilo.co/link/${id}`,
        ...(linkFixture === "missing_id" ? {} : { id: Number(id) }) });
    }
    if (url.includes("/getDetailLinkPayment/")) {
      detailCalls++;
      const id = url.split("/").at(-2)!;
      const link = links.get(id)!;
      return Response.json({ type: "200", detail: { id: Number(id), reference: detailFixture === "wrong_reference" ? "OTHER_REFERENCE" : link.reference,
        amount: link.amount, currency: link.currency, type: linkTypeFixture }, payments: link.approved ? [detailFixture === "legacy"
          ? { orderNumber: link.order }
          : { ...(detailFixture === "missing_id" ? {} : { id: 100_000 + Number(id) }),
            amount: link.amount, currency: link.currency, code: "1",
            create: detailFixture === "invalid_date" ? "2026-02-30 25:99:00" : "2026-10-14 18:00:00",
            card: "fixture-brand", response: "Aprobada", email: "guest@example.com", auth: "fixture-auth" }] : [] });
    }
    if (url.endsWith("/consultTransactions")) {
      transactionRequests.push(JSON.parse(String(init?.body)));
      const rows = [...links.entries()].filter(([, link]) => link.approved).map(([id, link]) => ({
        id: 100_000 + Number(id), orderNumber: link.order, amount: link.amount, currency: link.currency,
        code: "1", capture: "Capture", environment: link.environment, type: "Payment",
      }));
      if (transactionFixture === "invalid_response") return Response.json({ type: "200", response: {} });
      const result = rows.map((row) => ({ ...row,
        ...(transactionFixture === "unrelated" ? { id: row.id + 900_000 } : {}),
        ...(transactionFixture === "wrong_amount" ? { amount: "9999.99" } : {}),
        ...(transactionFixture === "wrong_currency" ? { currency: "CRC" } : {}),
        ...(transactionFixture === "wrong_environment" ? { environment: row.environment === "Test" ? "Production" : "Test" } : {}),
        ...(transactionFixture === "wrong_capture" ? { capture: "Authorize" } : {}),
      }));
      return Response.json({ type: "200", response: transactionFixture === "duplicate" ? [...result, ...result] : result });
    }
    if (url.endsWith("/consult")) {
      const body = JSON.parse(String(init?.body));
      const link = [...links.values()].find((entry) => entry.order === body.orderNumber);
      const id = [...links.entries()].find(([, entry]) => entry.order === body.orderNumber)?.[0];
      return Response.json({ type: "200", response: link?.approved ? [{ orderNumber: link.order,
        id_tilopay: 100_000 + Number(id) + (wrongConsultId ? 1 : 0),
        merchantId: "fixture-merchant",
        amount: link.amount, currency: link.currency, code: "1", capture: "Capture", environment: link.environment, type: "Payment" }] : [] });
    }
    if (url.endsWith("/deleteLinkPayment")) {
      closedLinks++;
      if (closeFixture === "http") return new Response("Private provider error fixture-password", { status: 401 });
      if (closeFixture === "timeout") throw new DOMException("Private provider URL", "TimeoutError");
      return Response.json({ type: closeLinkFailure ? "503" : closeFixture === "numeric" ? 200 : "200",
        status: closeFixture === "status-zero" ? 0 : 1, message: "Private provider error fixture-password" });
    }
    throw new Error(`Unexpected network request in tests: ${new URL(url).hostname}`);
  };

  try {
    const db = await import("../src/lib/booking-db");
    const service = await import("../src/lib/reservation-service");
    const manual = await import("../src/lib/admin-reservations");
    const auth = await import("../src/lib/admin-auth");
    const ical = await import("../src/lib/ical");
    const payments = await import("../src/lib/tilopay");
    const exportRoute = await import("../src/app/api/calendar/[dome]/calendar.ics/route");
    const testBookings = await import("../src/lib/test-bookings");
    const adminRoute = await import("../src/app/api/admin/blocks/route");
    const testKey = process.env.BOOKING_TEST_SECRET!;
    let paidBookingId = "";
    const payload = (start: string, end: string) => ({ dome: "domo-amplio", checkIn: start, checkOut: end,
      guests: 2, name: "Test Guest", email: "guest@example.com", phone: "+50688888888", country: "CR",
      expectedAmountCents: Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) * 12500,
      turnstileToken: "fixture" });
    const exportIcs = async () => (await exportRoute.GET(new Request("http://localhost/api/calendar"),
      { params: Promise.resolve({ dome: "domo-amplio" }) })).text();

    await t.test("password hashing and wrong passwords", async () => {
      assert(await verifyAdminPassword("A-private-test-password!", process.env.ADMIN_PASSWORD_HASH));
      assert.equal(await verifyAdminPassword("wrong", process.env.ADMIN_PASSWORD_HASH), false);
      await assert.rejects(hashAdminPassword("short"));
    });
    await t.test("untrusted request bodies are bounded and logs never include secrets or guest data", async () => {
      const { readJsonObject } = await import("../src/lib/request-body");
      const { logServerError } = await import("../src/lib/safe-log");
      const { validReservationId } = await import("../src/lib/booking-validation");
      const req = (body: string) => new Request("http://localhost", { method: "POST", body });
      await assert.rejects(readJsonObject(req('"' + "x".repeat(10_001) + '"')), { status: 413 });
      await assert.rejects(readJsonObject(req(JSON.stringify({ name: "é".repeat(6000) }))), { status: 413 });
      assert.equal(validReservationId("-".repeat(36)), false);
      assert.equal(validReservationId("00000000-0000-4000-8000-000000000001"), true);
      const original = console.error;
      let logged = "";
      console.error = (...args) => { logged = JSON.stringify(args); };
      try { logServerError("Sanitized failure", { message: "API_PRIVATE_PASSWORD", detail: "guest@example.com", stack: "private calendar URL", code: "23505", status: 503 }); }
      finally { console.error = original; }
      assert(logged.includes("23505")); assert(logged.includes("503"));
      for (const value of ["API_PRIVATE_PASSWORD", "guest@example.com", "private calendar URL"]) assert(!logged.includes(value));
    });
    await t.test("reservation API rejects cross-origin and malformed requests before creating bookings", async () => {
      const route = await import("../src/app/api/reservations/route");
      const request = (origin: string, body: string) => new Request("http://localhost/api/reservations", {
        method: "POST", headers: { origin }, body });
      assert.equal((await route.POST(request("https://attacker.example", "{}"))).status, 403);
      for (const body of ["null", "[]", "{bad"]) assert.equal((await route.POST(request("http://localhost", body))).status, 400);
      assert.equal((await route.POST(request("http://localhost", " ".repeat(10_001)))).status, 413);
    });
    await t.test("payment URL allowlist accepts the real tilo.co domain and rejects spoofed/insecure URLs", async () => {
      const { trustedTilopayPaymentUrl } = await import("../src/lib/tilopay-payment-url");
      for (const host of ["tilo.co", "app.tilopay.com", "admin.tilopay.com"]) {
        const url = `https://${host}/link/fixture==`;
        assert.equal(trustedTilopayPaymentUrl(url), url);
      }
      for (const value of [null, {}, "", "/link/fixture", "javascript:alert(1)",
        "http://tilo.co/link/fixture", "https://tilo.co.attacker.example/link/fixture",
        "https://eviltilo.co/link/fixture", "https://tilopay.com.attacker.example/link/fixture",
        "https://attacker.tilopay.com/link/fixture", "https://tilo.co@attacker.example/link/fixture",
        "https://attacker.example@tilo.co/link/fixture", "https://user:password@tilo.co/link/fixture",
        "https://tilo.co:444/link/fixture"]) assert.equal(trustedTilopayPaymentUrl(value), null);
    });
    await t.test("private endpoints reject anonymous users and cross-origin requests", async () => {
      const { readAdminJson } = await import("../src/lib/admin-http");
      for (const body of ["null", "[]", "123", "{invalid"]) {
        await assert.rejects(readAdminJson(new Request("http://localhost", { method: "POST", body })), { status: 400 });
      }
      await assert.rejects(auth.requireAdmin(), { status: 401 });
      const anonymous = await adminRoute.POST(new Request("http://localhost/api/admin/blocks", {
        method: "POST", headers: { origin: "http://localhost" }, body: "{}" }));
      assert.equal(anonymous.status, 401);
      assert.throws(() => auth.requireSameOrigin(new Request("http://localhost/api/admin/blocks", {
        headers: { origin: "https://attacker.example" } })), { status: 403 });
      assert.doesNotThrow(() => auth.requireSameOrigin(new Request("http://localhost:3000/api/admin/login", {
        headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" } })));
      process.env.SITE_ID = "fixture-site";
      Object.assign(process.env, { NODE_ENV: "production" });
      try {
        assert.doesNotThrow(() => auth.requireSameOrigin(new Request("http://localhost/api/admin/login", {
          headers: { origin: "https://fixture.netlify.app", host: "localhost", "x-forwarded-host": "attacker.example" } })));
        assert.throws(() => auth.requireSameOrigin(new Request("http://localhost/api/admin/login", {
          headers: { origin: "https://attacker.example", "x-forwarded-host": "attacker.example" } })), { status: 403 });
      } finally { delete process.env.SITE_ID; Object.assign(process.env, { NODE_ENV: "development" }); }
    });
    await t.test("sessions are hashed, expire, revoke on credential change and logout", async () => {
      const token = await auth.loginAdmin("owner", "A-private-test-password!", new Request("http://localhost"));
      cookieValues.set(auth.ADMIN_COOKIE, token);
      assert(await auth.adminSession());
      const stored = await sql.query<{ token_hash: string }>("SELECT token_hash FROM admin_sessions");
      assert.notEqual(stored.rows[0].token_hash, token);
      process.env.ADMIN_USERNAME = "changed";
      assert.equal(await auth.adminSession(), false);
      process.env.ADMIN_USERNAME = "owner";
      await sql.query("UPDATE admin_sessions SET expires_at = now() - interval '1 minute'");
      assert.equal(await auth.adminSession(), false);
      await auth.logoutAdmin();
      assert.equal(await auth.adminSession(), false);
      cookieValues.clear();
    });
    await t.test("admin login issues a secure cookie and authenticates block creation and logout", async () => {
      Object.assign(process.env, { NODE_ENV: "production", SITE_ID: "fixture-site" });
      try {
        const login = await import("../src/app/api/admin/login/route");
        const logout = await import("../src/app/api/admin/logout/route");
        const request = (path: string, body: object) => new Request(`https://fixture.netlify.app${path}`, {
          method: "POST", headers: { origin: "https://fixture.netlify.app", "content-type": "application/json" }, body: JSON.stringify(body) });
        const response = await login.POST(request("/api/admin/login", { username: "owner", password: "A-private-test-password!" }));
        assert.equal(response.status, 200);
        const cookie = response.headers.get("set-cookie")!;
        assert(/HttpOnly/i.test(cookie)); assert(/Secure/i.test(cookie)); assert(/SameSite=strict/i.test(cookie));
        assert(/Max-Age=28800/i.test(cookie));
        const token = cookie.match(/macasmoon_admin=([a-f0-9]{64})/)![1];
        cookieValues.set(auth.ADMIN_COOKIE, token);
        const block = await adminRoute.POST(request("/api/admin/blocks", { dome: "domo-amplio", checkIn: "2028-04-01", checkOut: "2028-04-02", note: "Private API block test" }));
        assert.equal(block.status, 201);
        assert.match(block.headers.get("cache-control")!, /no-store/);
        const { id } = await block.json();
        assert((await exportIcs()).includes("20280401"));
        await manual.removeManualBlock(id);
        assert.equal((await logout.POST(request("/api/admin/logout", {}))).status, 200);
        assert.equal(await auth.adminSession(), false);
      } finally { Object.assign(process.env, { NODE_ENV: "development" }); delete process.env.SITE_ID; cookieValues.clear(); }
    });
    await t.test("a guest can reserve with country only; tests never call payment creation", async () => {
      const result = await service.startReservation(payload("2028-05-04", "2028-05-05"), testKey, "http://localhost");
      assert.equal(result.status, "confirmed");
      assert.equal(createdPayments, 0);
      const booking = (await db.getBooking(result.id))!;
      assert.equal(booking.billing_address, "");
      const feed = await exportIcs();
      assert(feed.includes("DTSTART;VALUE=DATE:20280504"));
      assert(feed.includes("DTEND;VALUE=DATE:20280505"));
      assert(!feed.includes("guest@example.com"));
      assert(!feed.includes("Test Guest"));
      assert(!feed.includes(result.id));
      await assert.rejects(service.startReservation(payload("2028-05-04", "2028-05-05"), testKey, "http://localhost"), { status: 409 });
      await testBookings.cancelTestBooking(result.id);
      assert(!(await exportIcs()).includes("20280504"));
    });
    await t.test("manual blocks share night protection, export privately and disappear on removal", async () => {
      const id = await manual.createManualBlock({ dome: "domo-amplio", checkIn: "2028-05-10", checkOut: "2028-05-12", note: "PRIVATE maintenance" });
      const feed = await exportIcs();
      assert(feed.includes("20280510"));
      assert(!feed.includes("PRIVATE"));
      assert(feed.includes(createHash("sha256").update(id).digest("hex")));
      await assert.rejects(service.startReservation(payload("2028-05-11", "2028-05-12"), testKey, "http://localhost"), { status: 409 });
      await manual.removeManualBlock(id);
      assert(!(await exportIcs()).includes("20280510"));
    });
    await t.test("simultaneous local reservations cannot both own the same night", async () => {
      const attempts = await Promise.allSettled([1, 2].map(() => service.startReservation(payload("2028-06-01", "2028-06-02"), testKey, "http://localhost")));
      assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(attempts.filter((result) => result.status === "rejected").length, 1);
    });
    await t.test("production mode cannot use the free testing key", async () => {
      process.env.NEXT_PUBLIC_BOOKING_TEST_MODE = "false";
      await assert.rejects(service.startReservation(payload("2028-07-01", "2028-07-02"), testKey, "http://localhost"), { status: 403 });
      process.env.NEXT_PUBLIC_BOOKING_TEST_MODE = "true";
    });
    await t.test("incomplete checkout cannot allocate nights or create a payment link", async () => {
      const before = createdPayments;
      const user = process.env.TILOPAY_API_USER;
      delete process.env.TILOPAY_API_USER;
      try {
        await assert.rejects(service.startReservation(payload("2028-07-01", "2028-07-02"), null, "https://fixture.netlify.app"), { status: 503 });
        assert.equal(createdPayments, before);
        assert.equal((await sql.query("SELECT id FROM reservations WHERE check_in = '2028-07-01'")).rows.length, 0);
      } finally { process.env.TILOPAY_API_USER = user; }
    });
    await t.test("malformed webhooks and browser claims cannot approve a payment", async () => {
      const webhook = await import("../src/app/api/reservations/webhook/route");
      for (const body of ["null", "[]", "123", "{bad", JSON.stringify({ code: "1", tilopayLinkId: "invalid" })]) {
        assert.equal((await webhook.POST(new Request("https://fixture.netlify.app/api/reservations/webhook", { method: "POST", body }))).status, 400);
      }
      assert.equal((await webhook.POST(new Request("https://fixture.netlify.app/api/reservations/webhook", { method: "POST", body: " ".repeat(10_001) }))).status, 413);
    });
    await t.test("real flow stays pending until independently verified; no address sent to createLinkPayment", async () => {
      const beforeTokens = loginCalls;
      const result = await service.startReservation(payload("2028-07-02", "2028-07-03"), null, "https://fixture.netlify.app");
      paidBookingId = result.id;
      assert.equal(loginCalls, beforeTokens + 1);
      assert.equal(result.status, "pending");
      assert("paymentUrl" in result && result.paymentUrl.startsWith("https://tilo.co/link/"));
      assert.equal(paymentBody!.type, 1);
      assert(!("billToAddress" in paymentBody!));
      assert(!(await exportIcs()).includes("20280702"));
      assert.equal((await service.reconcilePayment(result.id)).status, "pending");
      const booking = (await db.getBooking(result.id))!;
      links.get(booking.payment_link_id!)!.approved = true;
      const verified = await service.reconcilePayment(result.id);
      assert.equal(verified.status, "confirmed");
      assert(verified.confirmation_email_sent_at); assert(verified.owner_notification_sent_at);
      assert.equal(loginCalls, beforeTokens + 1); // Reuse server-only token during its actual lifetime.
      assert((await exportIcs()).includes("20280702"));
      const beforeEmails = emailCalls;
      await service.reconcilePayment(result.id);
      assert.equal(emailCalls, beforeEmails);
    });
    await t.test("reservation API returns a trusted checkout link, never confirms without payment", async () => {
      const route = await import("../src/app/api/reservations/route");
      const response = await route.POST(new Request("https://fixture.netlify.app/api/reservations", {
        method: "POST", headers: { origin: "https://fixture.netlify.app" },
        body: JSON.stringify(payload("2029-01-01", "2029-01-02")),
      }));
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.status, "pending");
      assert(body.paymentUrl.startsWith("https://tilo.co/link/"));
      assert.equal((await db.getBooking(body.id))!.status, "pending");
      assert(!(await exportIcs()).includes("20290101"));
    });
    await t.test("live link payment IDs resolve to the exact authenticated transaction and both notifications", async () => {
      const result = await service.startReservation(payload("2029-03-01", "2029-03-02"), null, "https://fixture.netlify.app");
      const booking = (await db.getBooking(result.id))!;
      links.get(booking.payment_link_id!)!.approved = true;
      const beforeEmails = emailCalls;
      const beforeRequests = transactionRequests.length;
      // Verification alone is read-only: no confirmation or SMTP side effects.
      assert.equal(await payments.paymentApproved(booking), true);
      assert.equal((await db.getBooking(result.id))!.status, "pending");
      assert.equal(emailCalls, beforeEmails);
      assert.equal(transactionRequests.length, beforeRequests + 1);
      const request = transactionRequests.at(-1)!;
      assert.equal(request.startDate, "2026-10-13 00:00:00");
      assert.equal(request.endDate, "2026-10-15 23:59:59");
      assert.equal(request.environment, 1);
      assert.equal(request.onlyAproved, 1);
      assert.deepEqual(request.currency, ["USD"]);
      const route = await import("../src/app/api/reservations/[id]/route");
      const response = await route.GET(new Request(`http://localhost/api/reservations/${result.id}`),
        { params: Promise.resolve({ id: result.id }) });
      assert.equal(response.status, 200);
      const state = await response.json();
      assert.equal(state.status, "confirmed"); assert.equal(state.emailSent, true);
      assert.equal(emailCalls, beforeEmails + 2);
      assert((await db.getBooking(result.id))!.owner_notification_sent_at);
      await service.reconcilePayment(result.id);
      assert.equal(emailCalls, beforeEmails + 2);
    });
    await t.test("an unrelated approved transaction with the same amount cannot confirm the link", async () => {
      const booking = (await db.getBooking(paidBookingId))!;
      try {
        for (const fixture of ["unrelated", "wrong_amount", "wrong_currency", "wrong_environment", "wrong_capture"] as const) {
          transactionFixture = fixture;
          assert.equal(await payments.paymentApproved(booking), false, fixture);
        }
        transactionFixture = "success"; wrongConsultId = true;
        assert.equal(await payments.paymentApproved(booking), false);
      } finally { transactionFixture = "success"; wrongConsultId = false; }
    });
    await t.test("merchant ID is checked in consult even when the transaction list omits it", async () => {
      const booking = (await db.getBooking(paidBookingId))!;
      try {
        process.env.TILOPAY_MERCHANT_ID = "fixture-merchant";
        assert.equal(await payments.paymentApproved(booking), true);
        process.env.TILOPAY_MERCHANT_ID = "wrong-merchant";
        assert.equal(await payments.paymentApproved(booking), false);
      } finally { delete process.env.TILOPAY_MERCHANT_ID; }
    });
    await t.test("ambiguous/unsupported payment details fail safely with useful sanitized diagnostics", async () => {
      const booking = (await db.getBooking(paidBookingId))!;
      try {
        for (const fixture of ["missing_id", "invalid_date", "wrong_reference"] as const) {
          detailFixture = fixture;
          await assert.rejects(payments.paymentApproved(booking), { stage: "tilopay_check",
            reason: fixture === "wrong_reference" ? "link_mismatch" : "unsupported_payment" });
        }
        detailFixture = "live"; transactionFixture = "duplicate";
        await assert.rejects(payments.paymentApproved(booking), { stage: "tilopay_check", reason: "ambiguous_payment" });
        transactionFixture = "invalid_response";
        await assert.rejects(payments.paymentApproved(booking), { stage: "tilopay_check", reason: "invalid_response" });
      } finally { detailFixture = "live"; transactionFixture = "success"; }
    });
    await t.test("legacy authenticated orderNumber detail remains supported without history lookup", async () => {
      const booking = (await db.getBooking(paidBookingId))!;
      const before = transactionRequests.length;
      detailFixture = "legacy";
      try { assert.equal(await payments.paymentApproved(booking), true); assert.equal(transactionRequests.length, before); }
      finally { detailFixture = "live"; }
    });
    await t.test("a forged approval webhook never confirms; a verified one sends each notification only once", async () => {
      const result = await service.startReservation(payload("2029-03-03", "2029-03-04"), null, "https://fixture.netlify.app");
      const booking = (await db.getBooking(result.id))!;
      const webhook = await import("../src/app/api/reservations/webhook/route");
      const request = () => new Request("https://fixture.netlify.app/api/reservations/webhook", {
        method: "POST", body: JSON.stringify({ code: "1", tilopayLinkId: Number(booking.payment_link_id), orderNumber: "FORGED_ORDER" }),
      });
      const before = emailCalls;
      assert.equal((await webhook.POST(request())).status, 200);
      assert.equal((await db.getBooking(result.id))!.status, "pending");
      assert.equal(emailCalls, before);
      links.get(booking.payment_link_id!)!.approved = true;
      assert.equal((await webhook.POST(request())).status, 200);
      assert.equal((await db.getBooking(result.id))!.status, "confirmed");
      assert.equal(emailCalls, before + 2);
      assert.equal((await webhook.POST(request())).status, 200);
      assert.equal(emailCalls, before + 2);
    });
    await t.test("failed status checks return a support reference without personal data or confirming the booking", async () => {
      const result = await service.startReservation(payload("2029-03-05", "2029-03-06"), null, "https://fixture.netlify.app");
      const booking = (await db.getBooking(result.id))!;
      links.get(booking.payment_link_id!)!.approved = true;
      const route = await import("../src/app/api/reservations/[id]/route");
      const originalLog = console.error;
      let logged = "";
      console.error = (...args) => { logged = JSON.stringify(args); };
      const before = emailCalls;
      transactionFixture = "invalid_response";
      try {
        const response = await route.GET(new Request("http://localhost"), { params: Promise.resolve({ id: result.id }) });
        assert.equal(response.status, 503);
        const body = await response.json();
        assert.equal(response.headers.get("X-Request-ID"), body.requestId);
        assert.equal(response.headers.get("Cache-Control"), "no-store");
        assert(body.error.includes("no vuelvas a pagar"));
        const details = JSON.parse(logged)[1];
        assert.equal(details.stage, "tilopay_check");
        assert.equal(details.reason, "invalid_response");
        assert.equal(details.requestId, body.requestId);
        for (const value of ["guest@example.com", "fixture-auth", "fixture-token"]) assert(!(logged + JSON.stringify(body)).includes(value));
        assert.equal((await db.getBooking(result.id))!.status, "pending");
        assert.equal(emailCalls, before);
      } finally { transactionFixture = "success"; console.error = originalLog; }
    });
    await t.test("provider failures identify the stage without exposing credentials and release unpaid nights", async () => {
      const route = await import("../src/app/api/reservations/route");
      const originalLog = console.error;
      let logged = "";
      console.error = (...args) => { logged = JSON.stringify(args); };
      const beforeEmails = emailCalls;
      try {
        const cases = [
          ["http", "http"], ["reject", "rejected"], ["bad_json", "invalid_response"],
          ["unsafe_url", "invalid_payment_url"], ["missing_id", "invalid_response"],
          ["timeout", "timeout"], ["connection", "network"],
        ] as const;
        for (const [index, [fixture, reason]] of cases.entries()) {
          linkFixture = fixture;
          const start = `2029-01-${String(10 + index).padStart(2, "0")}`;
          const end = `2029-01-${String(11 + index).padStart(2, "0")}`;
          const response = await route.POST(new Request("https://fixture.netlify.app/api/reservations", {
            method: "POST", headers: { origin: "https://fixture.netlify.app" },
            body: JSON.stringify(payload(start, end)),
          }));
          assert.equal(response.status, 502);
          const body = await response.json();
          assert.match(body.requestId, /^[a-f0-9-]{36}$/);
          assert.equal(response.headers.get("X-Request-ID"), body.requestId);
          assert.equal(response.headers.get("Cache-Control"), "no-store");
          assert(body.error.includes("Tilopay"));
          assert.equal(body.paymentUrl, undefined);
          const details = JSON.parse(logged)[1];
          assert.equal(details.stage, "tilopay_link");
          assert.equal(details.reason, reason);
          assert.equal(details.requestId, body.requestId);
          if (fixture === "http") assert.equal(details.upstreamStatus, 403);
          if (fixture === "reject") assert.equal(details.providerCode, "422");
          if (fixture === "connection") assert.equal(details.code, "ECONNRESET");
          const output = logged + JSON.stringify(body);
          for (const secret of ["fixture-password", "Private provider body", "guest@example.com", "merchant URL", "attacker.example"]) assert(!output.includes(secret));
          const rows = await sql.query<{ status: string }>("SELECT status FROM reservations WHERE check_in = $1", [start]);
          assert.equal(rows.rows[0].status, "expired");
          assert.equal((await sql.query("SELECT night FROM reservation_nights WHERE night = $1", [start])).rows.length, 0);
        }
        assert.equal(emailCalls, beforeEmails);
      } finally { linkFixture = "success"; console.error = originalLog; }
    });
    await t.test("a failed read after reservation creation also releases the hold", async () => {
      failBookingRead = true;
      await assert.rejects(service.startReservation(payload("2029-02-01", "2029-02-02"), null,
        "https://fixture.netlify.app"), { stage: "reservation_read", reason: "unexpected" });
      assert.equal((await sql.query<{ status: string }>("SELECT status FROM reservations WHERE check_in = '2029-02-01'")).rows[0].status, "expired");
      assert.equal((await sql.query("SELECT night FROM reservation_nights WHERE night = '2029-02-01'")).rows.length, 0);
    });
    await t.test("API authentication errors retain safe stage/status and release unpaid nights", async () => {
      const originalPassword = process.env.TILOPAY_API_PASSWORD;
      const beforePayments = createdPayments;
      try {
        for (const [index, fixture] of (["http", "missing_token"] as const).entries()) {
          process.env.TILOPAY_API_PASSWORD = `invalid-fixture-${index}`;
          authFixture = fixture;
          const start = `2029-02-${10 + index}`;
          const end = `2029-02-${11 + index}`;
          await assert.rejects(service.startReservation(payload(start, end), null,
            "https://fixture.netlify.app"), { stage: "tilopay_auth", reason: fixture === "http" ? "http" : "missing_token",
            ...(fixture === "http" ? { upstreamStatus: 401 } : {}) });
          assert.equal((await sql.query<{ status: string }>("SELECT status FROM reservations WHERE check_in = $1", [start])).rows[0].status, "expired");
          assert.equal((await sql.query("SELECT night FROM reservation_nights WHERE night = $1", [start])).rows.length, 0);
        }
        assert.equal(createdPayments, beforePayments);
      } finally { authFixture = "success"; process.env.TILOPAY_API_PASSWORD = originalPassword; }
    });
    await t.test("wrong amount, currency, environment or capture cannot confirm payment", async () => {
      const booking = (await db.getBooking(paidBookingId))!;
      const payment = { orderNumber: "TPT10", amount: "125.00", currency: "USD", code: "1", capture: "Capture", environment: "Test", type: "Payment" };
      assert(payments.matchesApprovedPayment(payment, booking, "TPT10"));
      for (const change of [{ amount: "0.00" }, { amount: "125.001" }, { currency: "CRC" }, { environment: "Production" },
        { code: "2" }, { capture: "Authorize" }, { type: "Refund" }, { orderNumber: "other" }]) {
        assert.equal(payments.matchesApprovedPayment({ ...payment, ...change }, booking, "TPT10"), false);
      }
      process.env.TILOPAY_MERCHANT_ID = "12345";
      try {
        assert.equal(payments.matchesApprovedPayment(payment, booking, "TPT10"), false);
        assert.equal(payments.matchesApprovedPayment({ ...payment, merchantId: "other" }, booking, "TPT10"), false);
        assert(payments.matchesApprovedPayment({ ...payment, merchantId: "12345" }, booking, "TPT10"));
      } finally { delete process.env.TILOPAY_MERCHANT_ID; }
    });
    await t.test("rotated credentials do not reuse the previous API token", async () => {
      const booking = (await db.getBooking(paidBookingId))!;
      const oldPassword = process.env.TILOPAY_API_PASSWORD;
      const before = loginCalls;
      process.env.TILOPAY_API_PASSWORD = "rotated_fixture";
      try { assert(await payments.paymentApproved(booking)); assert.equal(loginCalls, before + 1); }
      finally { process.env.TILOPAY_API_PASSWORD = oldPassword; }
    });
    await t.test("Gmail uses TLS and a single sender; SMTP failure never cancels a paid booking and retries serialize", async () => {
      const { sendConfirmation } = await import("../src/lib/booking-email");
      const result = await service.startReservation(payload("2028-07-10", "2028-07-11"), null, "https://fixture.netlify.app");
      const booking = (await db.getBooking(result.id))!;
      links.get(booking.payment_link_id!)!.approved = true;
      const originalLog = console.error;
      smtpFailure = true;
      console.error = () => {};
      try { assert.equal((await service.reconcilePayment(result.id)).status, "confirmed"); }
      finally { smtpFailure = false; console.error = originalLog; }
      const confirmed = (await db.getBooking(result.id))!;
      assert.equal(confirmed.confirmation_email_sent_at, null);
      const before = emailCalls;
      const results = await Promise.all([sendConfirmation(confirmed), sendConfirmation(confirmed)]);
      assert.equal(results.filter(Boolean).length, 1);
      assert.equal(emailCalls, before + 2);
      assert((await db.getBooking(result.id))!.confirmation_email_sent_at);
      assert((await db.getBooking(result.id))!.owner_notification_sent_at);
      assert.equal(smtpOptions!.host, "smtp.gmail.com"); assert.equal(smtpOptions!.port, 465);
      assert.equal(smtpOptions!.secure, true); assert.equal(smtpOptions!.debug, false);
      assert.deepEqual(lastEmail!.from, { name: "Macas Moon Glampings", address: "fixture@gmail.com" });
      assert(String(lastEmail!.text).includes("sin cargo real"));
      assert(!String(lastEmail!.text).includes("PRUEBA"));
    });
    await t.test("professional guest and owner messages are separate, complete and escaped", async () => {
      const { bookingEmails } = await import("../src/lib/booking-email-content");
      const booking = (await db.getBooking(paidBookingId))!;
      const content = bookingEmails({ ...booking, guest_name: '<script>alert("x")</script> & Guest' }, "https://fixture.netlify.app");
      assert(content.guest.subject.includes("Macas Moon Glampings"));
      assert(!content.guest.subject.includes("PRUEBA"));
      for (const message of [content.guest, content.owner]) {
        assert(message.html.includes('lang="es"')); assert(message.text.includes("2028"));
        assert(!message.html.includes("<script>")); assert(message.html.includes("&lt;script&gt;"));
        assert(message.text.includes("factura") || message.html.includes("factura"));
      }
      for (const value of [booking.id, booking.guest_email, booking.guest_phone, "Costa Rica", "Noches", "Huéspedes", "USD", booking.payment_reference!]) assert(content.owner.text.includes(value));
      assert(content.owner.html.includes("/admin")); assert(!content.guest.html.includes("/admin"));
      const pair = sentEmails.filter((email) => String(email.messageId).includes(booking.id));
      assert.equal(pair.length, 2);
      assert.equal((pair[0].to as { address: string }).address, booking.guest_email);
      assert.equal((pair[1].to as { address: string }).address, "fixture@gmail.com");
      assert(!("cc" in pair[0])); assert(!("bcc" in pair[0]));
      assert.notEqual(pair[0].messageId, pair[1].messageId);
      assert(!String(pair[0].text).includes("Referencia de pago"));
    });
    await t.test("guest and owner failures retry independently without losing the delivered marker", async () => {
      const { sendConfirmation } = await import("../src/lib/booking-email");
      const originalLog = console.error;
      console.error = () => {};
      try {
        for (const [index, failure] of (["owner", "guest"] as const).entries()) {
          const start = `2028-07-${14 + index * 2}`;
          const end = `2028-07-${15 + index * 2}`;
          const result = await service.startReservation(payload(start, end), null, "https://fixture.netlify.app");
          const pending = (await db.getBooking(result.id))!;
          const beforePending = emailCalls;
          assert.equal(await sendConfirmation(pending), false);
          assert.equal(emailCalls, beforePending);
          links.get(pending.payment_link_id!)!.approved = true;
          smtpFailedAudience = failure;
          assert.equal((await service.reconcilePayment(result.id)).status, "confirmed");
          const current = (await db.getBooking(result.id))!;
          assert.equal(Boolean(current.confirmation_email_sent_at), failure !== "guest");
          assert.equal(Boolean(current.owner_notification_sent_at), failure !== "owner");
          const calendar = await manual.adminCalendar("domo-amplio", "2028-07-01", "2028-08-01", false);
          const visible = calendar.reservations.find((row) => row.id === current.id)!;
          assert.equal(visible.ownerEmailSent, failure !== "owner");
          smtpFailedAudience = null;
          const before = emailCalls;
          assert(await sendConfirmation(current));
          assert.equal(emailCalls, before + 1);
          const sent = (await db.getBooking(result.id))!;
          assert(sent.confirmation_email_sent_at); assert(sent.owner_notification_sent_at);
          assert.equal(await sendConfirmation(current), false);
        }
      } finally { smtpFailedAudience = null; console.error = originalLog; }
    });
    await t.test("legacy reservations do not create retroactive owner notifications", async () => {
      const { sendConfirmation } = await import("../src/lib/booking-email");
      await sql.query("UPDATE reservations SET confirmation_email_sent_at = now() WHERE id = $1", [legacyId]);
      const legacy = (await db.getBooking(legacyId))!;
      const before = emailCalls;
      assert.equal(await sendConfirmation(legacy), false);
      assert.equal(emailCalls, before);
    });
    await t.test("missing email credentials do not prevent verified payment confirmation", async () => {
      const password = process.env.SMTP_PASSWORD;
      delete process.env.SMTP_PASSWORD;
      try {
        const result = await service.startReservation(payload("2028-07-12", "2028-07-13"), null, "https://fixture.netlify.app");
        const booking = (await db.getBooking(result.id))!;
        links.get(booking.payment_link_id!)!.approved = true;
        assert.equal((await service.reconcilePayment(result.id)).status, "confirmed");
        assert.equal((await db.getBooking(result.id))!.confirmation_email_sent_at, null);
      } finally { process.env.SMTP_PASSWORD = password; }
    });
    await t.test("late approved payment is flagged, never silently confirmed", async () => {
      const result = await service.startReservation(payload("2028-08-01", "2028-08-02"), null, "https://fixture.netlify.app");
      await sql.query("UPDATE reservations SET expires_at = now() - interval '1 minute' WHERE id = $1", [result.id]);
      const booking = (await db.getBooking(result.id))!;
      links.get(booking.payment_link_id!)!.approved = true;
      await assert.rejects(service.reconcilePayment(result.id), { status: 409 });
      const current = (await db.getBooking(result.id))!;
      assert.equal(current.status, "expired");
      assert(current.payment_issue);
      assert(!(await exportIcs()).includes("20280801"));
    });
    await t.test("failed external calendar stops bookings and manual blocks", async () => {
      feedFailure = true;
      await assert.rejects(service.startReservation(payload("2028-09-01", "2028-09-02"), testKey, "http://localhost"), { status: 503 });
      await assert.rejects(manual.createManualBlock({ dome: "domo-amplio", checkIn: "2028-09-01", checkOut: "2028-09-02", note: "test" }), { status: 503 });
      feedFailure = false;
    });
    await t.test("imported external blocks are not re-exported by this web", async () => {
      feedEvent = "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20281001\r\nDTEND;VALUE=DATE:20281002\r\nEND:VEVENT";
      assert((await ical.getAvailability("domo-amplio", true)).blocked.some((range) => range.start === "2028-10-01"));
      assert(!(await exportIcs()).includes("20281001"));
      feedEvent = "";
    });
    await t.test("iCal exports stay available when sales are disabled and retain RFC line folding", async () => {
      const savedActive = process.env.BOOKING_ACTIVE_DOMES;
      try {
        process.env.BOOKING_ACTIVE_DOMES = "domo-amplio";
        const known = await exportRoute.GET(new Request("http://localhost/calendar"), { params: Promise.resolve({ dome: "domo-romantico" }) });
        assert.equal(known.status, 200);
        assert.match(known.headers.get("content-type")!, /^text\/calendar/);
        assert.match(known.headers.get("content-disposition")!, /domo-romantico\.ics/);
        const emptyFeed = await known.text();
        assert(emptyFeed.startsWith("BEGIN:VCALENDAR\r\n"));
        assert(emptyFeed.endsWith("END:VCALENDAR\r\n"));
        assert.deepEqual(ical.parseIcal(emptyFeed), []);
        process.env.BOOKING_ACTIVE_DOMES = "domo-romantico";
        const closedWide = await exportRoute.GET(new Request("http://localhost/calendar"), { params: Promise.resolve({ dome: "domo-amplio" }) });
        assert.equal(closedWide.status, 200);
        const existingFeed = await closedWide.text();
        assert(ical.parseIcal(existingFeed).length > 0);
        assert(!existingFeed.includes("guest@example.com"));
        assert(!existingFeed.includes("Test Guest"));
      } finally {
        if (savedActive === undefined) delete process.env.BOOKING_ACTIVE_DOMES;
        else process.env.BOOKING_ACTIVE_DOMES = savedActive;
      }
      const unknown = await exportRoute.GET(new Request("http://localhost/calendar"), { params: Promise.resolve({ dome: "invalid" }) });
      assert.equal(unknown.status, 404);
      const { serializeIcal } = await import("../src/lib/ical-export");
      const source = ["BEGIN:VCALENDAR", "UID:" + "a".repeat(64) + "@macasmoon.com", "SUMMARY:" + "á🌙".repeat(40), "END:VCALENDAR"];
      const serialized = serializeIcal(source);
      assert.equal(serialized.replace(/\r\n /g, ""), source.join("\r\n") + "\r\n");
      assert(serialized.split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75));
      const feed = await exportIcs();
      assert(feed.endsWith("END:VCALENDAR\r\n"));
      assert(feed.split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75));
      assert(ical.parseIcal(feed).length > 0);
    });
    await t.test("invalid countries, inactive dome and tampered prices are rejected", async () => {
      await assert.rejects(service.startReservation({ ...payload("2028-11-01", "2028-11-02"), country: "ZZ" }, testKey, "http://localhost"), { status: 400 });
      await assert.rejects(service.startReservation({ ...payload("2028-11-01", "2028-11-02"), dome: "domo-romantico" }, testKey, "http://localhost"), { status: 503 });
      await assert.rejects(service.startReservation({ ...payload("2028-11-01", "2028-11-02"), expectedAmountCents: 1 }, testKey, "http://localhost"), { status: 409 });
    });
    await t.test("both domes accept one-cent nightly prices and payment receives exactly USD 0.01", async () => {
      const oldActive = process.env.BOOKING_ACTIVE_DOMES;
      const oldWide = process.env.PRICE_DOMO_AMPLIO_CENTS;
      const oldRomantic = process.env.PRICE_DOMO_ROMANTICO_CENTS;
      try {
        process.env.PRICE_DOMO_AMPLIO_CENTS = "1";
        process.env.PRICE_DOMO_ROMANTICO_CENTS = "1";
        process.env.BOOKING_ACTIVE_DOMES = "domo-romantico,domo-amplio";
        const pricing = await import("../src/app/api/pricing/route");
        const response = await pricing.GET();
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { currency: "USD", perNight: { "domo-romantico": 1, "domo-amplio": 1 } });
        process.env.BOOKING_ACTIVE_DOMES = "domo-amplio";
        const result = await service.startReservation({ ...payload("2028-12-01", "2028-12-02"), expectedAmountCents: 1 }, null, "https://fixture.netlify.app");
        assert.equal(result.amountCents, 1);
        assert.equal(paymentBody!.amount, "0.01");
        assert.equal(paymentBody!.currency, "USD");
        const booking = (await db.getBooking(result.id))!;
        assert.equal(booking.amount_cents, 1);
        links.get(booking.payment_link_id!)!.approved = true;
        assert.equal((await service.reconcilePayment(result.id)).status, "confirmed");
        process.env.BOOKING_ACTIVE_DOMES = "domo-romantico,domo-amplio";
        const romantic = await service.startReservation({ ...payload("2028-12-01", "2028-12-02"), dome: "domo-romantico", expectedAmountCents: 1 }, null, "https://fixture.netlify.app");
        const romanticBooking = (await db.getBooking(romantic.id))!;
        links.get(romanticBooking.payment_link_id!)!.approved = true;
        assert.equal((await service.reconcilePayment(romantic.id)).status, "confirmed");
        const romanticFeed = await exportRoute.GET(new Request("http://localhost/calendar"), { params: Promise.resolve({ dome: "domo-romantico" }) });
        assert((await romanticFeed.text()).includes(createHash("sha256").update(romantic.id).digest("hex")));
        const wideFeed = await exportIcs();
        assert(!wideFeed.includes(createHash("sha256").update(romantic.id).digest("hex")));
        assert.equal(romanticBooking.amount_cents, 1);
      } finally {
        for (const [key, value] of [["BOOKING_ACTIVE_DOMES", oldActive], ["PRICE_DOMO_AMPLIO_CENTS", oldWide], ["PRICE_DOMO_ROMANTICO_CENTS", oldRomantic]]) {
          if (value === undefined) delete process.env[key!];
          else process.env[key!] = value;
        }
      }
    });
    await t.test("both domes reserve independently at USD 170 and admin calendars/issues stay isolated", async () => {
      const keys = ["BOOKING_ACTIVE_DOMES", "PRICE_DOMO_ROMANTICO_CENTS", "PRICE_DOMO_AMPLIO_CENTS"];
      const saved = keys.map((key) => process.env[key]);
      try {
        process.env.BOOKING_ACTIVE_DOMES = "domo-romantico,domo-amplio";
        process.env.PRICE_DOMO_ROMANTICO_CENTS = "17000";
        process.env.PRICE_DOMO_AMPLIO_CENTS = "17000";
        const pricing = await import("../src/app/api/pricing/route");
        assert.deepEqual(await (await pricing.GET()).json(), { currency: "USD", perNight: { "domo-romantico": 17000, "domo-amplio": 17000 } });
        const ids = new Map<string, string>();
        for (const dome of ["domo-romantico", "domo-amplio"]) {
          const result = await service.startReservation({ ...payload("2029-07-01", "2029-07-03"), dome,
            guests: dome === "domo-romantico" ? 2 : 4, expectedAmountCents: 34000 }, null, "https://fixture.netlify.app");
          assert.equal(result.amountCents, 34000); assert.equal(paymentBody!.amount, "340.00");
          const booking = (await db.getBooking(result.id))!;
          links.get(booking.payment_link_id!)!.approved = true;
          assert.equal((await service.reconcilePayment(result.id)).status, "confirmed");
          await sql.query("UPDATE reservations SET payment_issue = 'Revisar registro' WHERE id = $1", [result.id]);
          ids.set(dome, result.id);
        }
        for (const dome of ["domo-romantico", "domo-amplio"]) {
          const calendar = await manual.adminCalendar(dome, "2029-07-01", "2029-08-01", true);
          assert.equal(calendar.dome, dome); assert.equal(calendar.bookingEnabled, true);
          assert(calendar.reservations.some((row) => row.id === ids.get(dome)));
          assert(calendar.reservations.every((row) => row.dome === dome));
          assert(calendar.issues.length > 0); assert(calendar.issues.every((row) => row.dome === dome));
          const response = await exportRoute.GET(new Request("http://localhost/calendar"), { params: Promise.resolve({ dome }) });
          const ics = await response.text();
          assert(ics.includes(createHash("sha256").update(ids.get(dome)!).digest("hex")));
          const other = dome === "domo-amplio" ? "domo-romantico" : "domo-amplio";
          assert(!ics.includes(createHash("sha256").update(ids.get(other)!).digest("hex")));
        }
        await assert.rejects(service.startReservation({ ...payload("2029-07-05", "2029-07-06"), dome: "domo-romantico", guests: 3, expectedAmountCents: 17000 }, null, "https://fixture.netlify.app"), { status: 400 });
        const blocks = await Promise.all(["domo-romantico", "domo-amplio"].map((dome) => manual.createManualBlock({ dome, checkIn: "2029-07-10", checkOut: "2029-07-11", note: "Mantenimiento" })));
        assert.equal(blocks.length, 2);
        for (const id of blocks) await manual.removeManualBlock(id);
      } finally { keys.forEach((key, index) => { if (saved[index] === undefined) delete process.env[key]; else process.env[key] = saved[index]; }); }
    });
    await t.test("romantic import calendars never block the wide dome, and missing links fail closed", async () => {
      const savedActive = process.env.BOOKING_ACTIVE_DOMES;
      const savedFeed = process.env.ICAL_DOMO_ROMANTICO_EXPEDIA_URL;
      try {
        process.env.BOOKING_ACTIVE_DOMES = "domo-romantico,domo-amplio";
        domeFeedEvents.set("domo-romantico", "BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20290801\r\nDTEND;VALUE=DATE:20290802\r\nEND:VEVENT");
        assert((await ical.getAvailability("domo-romantico", true)).blocked.some((range) => range.start === "2029-08-01"));
        assert(!(await ical.getAvailability("domo-amplio", true)).blocked.some((range) => range.start === "2029-08-01"));
        const before = createdPayments;
        delete process.env.ICAL_DOMO_ROMANTICO_EXPEDIA_URL;
        const availability = await ical.getAvailability("domo-romantico");
        assert.notEqual(availability.status, "ready");
        await assert.rejects(service.startReservation({ ...payload("2029-08-03", "2029-08-04"), dome: "domo-romantico" }, testKey, "http://localhost"), { status: 503 });
        assert.equal(createdPayments, before);
        assert.equal((await sql.query("SELECT id FROM reservations WHERE dome='domo-romantico' AND check_in='2029-08-03'")).rows.length, 0);
      } finally {
        process.env.BOOKING_ACTIVE_DOMES = savedActive;
        process.env.ICAL_DOMO_ROMANTICO_EXPEDIA_URL = savedFeed;
        domeFeedEvents.clear();
      }
    });
    await t.test("explicit romantic selection never silently switches to the wide dome", async () => {
      const { resolveBookingDome } = await import("../src/lib/booking-selection");
      const both = { "domo-romantico": 17000, "domo-amplio": 17000 };
      assert.equal(resolveBookingDome("domo-romantico", both), "domo-romantico");
      assert.equal(resolveBookingDome("domo-amplio", both), "domo-amplio");
      assert.equal(resolveBookingDome("domo-romantico", { "domo-amplio": 17000 }), "");
      assert.equal(resolveBookingDome("domo-romantico", undefined), "");
      assert.equal(resolveBookingDome("", { "domo-amplio": 17000 }), "domo-amplio");
    });
    await t.test("admin always lists both domes and can inspect an inactive romantic calendar", async () => {
      const { getAdminDomeOptions } = await import("../src/lib/active-domes");
      assert.deepEqual(getAdminDomeOptions().map(({ slug, enabled }) => ({ slug, enabled })), [
        { slug: "domo-amplio", enabled: true }, { slug: "domo-romantico", enabled: false },
      ]);
      const calendar = await manual.adminCalendar("domo-romantico", "2029-07-01", "2029-08-01", false);
      assert.equal(calendar.dome, "domo-romantico"); assert.equal(calendar.bookingEnabled, false);
      await assert.rejects(manual.adminCalendar("unknown", "2029-07-01", "2029-08-01", false), { status: 400 });
    });
    await t.test("admin interface renders both calendar options with commercial wording", async () => {
      const { createElement } = await import("react");
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
      const { AdminDashboard } = await import("../src/components/admin/AdminDashboard");
      const { getAdminDomeOptions } = await import("../src/lib/active-domes");
      const router = { bfcacheId: "fixture", back() {}, forward() {}, refresh() {}, hmrRefresh() {}, push() {}, replace() {}, prefetch() {} };
      const render = (environment: string, missing: string[] = [], emailMissing: string[] = []) => renderToStaticMarkup(createElement(AppRouterContext.Provider,
        { value: router }, createElement(AdminDashboard, { domes: getAdminDomeOptions(),
          checkout: { enabled: true, freeTest: false, environment, missing, emailMissing }, siteOrigin: "https://fixture.netlify.app" })));
      const html = render("Production");
      assert(html.includes('value="domo-romantico"')); assert(html.includes('value="domo-amplio"'));
      assert(html.includes("Ver calendario de")); assert(html.includes("Romántico")); assert(html.includes("Amplio"));
      assert(html.includes("Mostrar historial"));
      assert(html.includes("Editar precios"));
      assert(!/\b(?:pruebas?|simulad[oa]s?|test)\b/i.test(html));
      assert(html.includes("https://fixture.netlify.app/api/calendar/domo-amplio/calendar.ics"));
      for (const environment of ["Test", "Production"]) {
        const clean = render(environment);
        assert(!clean.includes("Operaciones sin cargos reales"));
        assert(!clean.includes("Estas opciones no verifican"));
        assert(!clean.includes("reaperturas en Expedia"));
        assert(!clean.includes("El motivo y los datos de huéspedes nunca aparecen en el iCal público."));
        assert(!clean.includes("Motivo privado"));
        assert(clean.includes("Motivo"));
        assert(!clean.includes("Falta configurar:"));
        assert(!clean.includes("Correo pendiente de configurar:"));
        assert(!clean.includes('role="alert"'));
      }
      const incomplete = render("Test", ["TURNSTILE_SECRET_KEY"], ["SMTP_PASSWORD"]);
      assert(incomplete.includes('role="alert"'));
      assert(incomplete.includes("Falta configurar: TURNSTILE_SECRET_KEY"));
      assert(incomplete.includes("Correo pendiente de configurar: SMTP_PASSWORD"));
    });
    await t.test("commercial emails have no trial labels; simulated payments are never described as money charged", async () => {
      const { bookingEmails } = await import("../src/lib/booking-email-content");
      const booking = { ...(await db.getBooking(paidBookingId))!, guest_name: "María Castro" };
      const production = bookingEmails({ ...booking, payment_environment: "Production" }, "https://fixture.netlify.app");
      const simulated = bookingEmails({ ...booking, payment_environment: "Test" }, "https://fixture.netlify.app");
      for (const audience of ["guest", "owner"] as const) {
        const real = production[audience]; const demo = simulated[audience];
        assert(!/prueba|simulad|\btest\b/i.test(real.subject + real.text + real.html));
        assert(real.text.includes("Total pagado")); assert(real.text.includes("pago confirmado"));
        assert(!/prueba|\btest\b/i.test(demo.subject + demo.text + demo.html));
        assert(demo.text.includes("sin cargo real")); assert(!demo.text.includes("Total pagado"));
      }
    });
    await t.test("deploy checks distinguish free, paid and production configuration without reading real env", async () => {
      const { parseBookingEnv, validateBookingEnv } = await import("../scripts/booking-env.mjs");
      assert.equal(parseBookingEnv("BOOKING_ENABLED=true\nBOOKING_ENABLED=false").errors.length, 1);
      assert.equal(parseBookingEnv('ADMIN_USERNAME="owner"').values.get("ADMIN_USERNAME"), "owner");
      const values = new Map<string, string>([
        ["BOOKING_ENABLED", "true"], ["BOOKING_ACTIVE_DOMES", "domo-amplio"], ["BOOKING_CURRENCY", "USD"],
        ["PRICE_DOMO_AMPLIO_CENTS", "1"], ["NEXT_PUBLIC_BOOKING_TEST_MODE", "false"], ["TILOPAY_CHECKOUT_ENABLED", "true"],
        ["BOOKING_RECONCILE_ENABLED", "true"], ["BOOKING_RECONCILE_SECRET", "fixture_only_".repeat(4)],
        ["TILOPAY_EXPECTED_ENVIRONMENT", "Test"], ["TILOPAY_API_USER", "fixture"], ["TILOPAY_API_PASSWORD", "fixture"],
        ["TILOPAY_API_KEY", "fixture"], ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "fixture"], ["TURNSTILE_SECRET_KEY", "fixture"],
        ["SMTP_USER", "fixture@gmail.com"], ["SMTP_PASSWORD", "abcd efgh ijkl mnop"], ["BOOKING_REPLY_TO", "owner@example.com"],
        ["ADMIN_USERNAME", "owner"], ["ADMIN_PASSWORD_HASH", process.env.ADMIN_PASSWORD_HASH!],
        ["ICAL_DOMO_AMPLIO_AIRBNB_URL", "https://airbnb.example/calendar.ics"], ["ICAL_DOMO_AMPLIO_EXPEDIA_URL", "https://expedia.example/calendar.ics"],
      ]);
      assert.deepEqual(validateBookingEnv(values).errors, []);
      values.delete("SMTP_PASSWORD");
      assert(validateBookingEnv(values).errors.some((error: string) => error.includes("SMTP_PASSWORD")));
      values.set("SMTP_PASSWORD", "abcdefghijklmnop");
      assert(validateBookingEnv(values, { production: true }).errors.length > 0);
      values.set("TILOPAY_EXPECTED_ENVIRONMENT", "Production");
      assert.deepEqual(validateBookingEnv(values, { production: true }).errors, []);
      values.set("BOOKING_RECONCILE_ENABLED", "false");
      assert(validateBookingEnv(values, { production: true }).errors.some((error: string) => error.includes("BOOKING_RECONCILE_ENABLED")));
      values.set("BOOKING_RECONCILE_ENABLED", "true");
      values.set("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
      assert(validateBookingEnv(values).errors.some((error: string) => error.includes("demostración")));
      values.set("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "fixture");
      values.set("TURNSTILE_SECRET_KEY", "1x0000000000000000000000000000000AA");
      assert(validateBookingEnv(values).errors.some((error: string) => error.includes("demostración")));
      values.set("TURNSTILE_SECRET_KEY", "fixture");
      values.set("BOOKING_ACTIVE_DOMES", "domo-romantico,domo-amplio");
      assert(validateBookingEnv(values).errors.some((error: string) => error.includes("ROMANTICO")));
      values.set("BOOKING_ACTIVE_DOMES", "domo-amplio");
      values.set("NEXT_PUBLIC_TILOPAY_API_KEY", "fixture-only-private-key");
      assert(validateBookingEnv(values).errors.some((error: string) => error.includes("NEXT_PUBLIC_TILOPAY_API_KEY")));
      values.delete("NEXT_PUBLIC_TILOPAY_API_KEY");
      values.delete("TILOPAY_API_KEY");
      assert(validateBookingEnv(values).errors.some((error: string) => error.includes("TILOPAY_API_KEY")));
      values.set("NEXT_PUBLIC_BOOKING_TEST_MODE", "true");
      values.set("TILOPAY_CHECKOUT_ENABLED", "false"); values.set("BOOKING_RECONCILE_ENABLED", "false");
      values.set("BOOKING_TEST_SECRET", "fixture_only_".repeat(4));
      assert.deepEqual(validateBookingEnv(values).errors, []);
      assert(validateBookingEnv(values, { production: true }).errors.length > 0);
    });
    await t.test("published pricing checks detect old Netlify values without reading secrets or creating bookings", async () => {
      const { comparePublishedPricing } = await import("../scripts/booking-env.mjs");
      const values = new Map([
        ["BOOKING_ACTIVE_DOMES", "domo-romantico,domo-amplio"], ["BOOKING_CURRENCY", "USD"],
        ["PRICE_DOMO_ROMANTICO_CENTS", "17000"], ["PRICE_DOMO_AMPLIO_CENTS", "17000"],
      ]);
      const both = { currency: "USD", perNight: { "domo-romantico": 17000, "domo-amplio": 17000 } };
      assert.deepEqual(comparePublishedPricing(values, both), []);
      const stale = comparePublishedPricing(values, { currency: "USD", perNight: { "domo-amplio": 1 } });
      assert(stale.some((error: string) => error.includes("BOOKING_ACTIVE_DOMES")));
      assert(stale.some((error: string) => error.includes("PRICE_DOMO_AMPLIO_CENTS")));
      assert(comparePublishedPricing(values, { ...both, currency: "CRC" }).some((error: string) => error.includes("BOOKING_CURRENCY")));
      assert(comparePublishedPricing(values, { ...both, perNight: { ...both.perNight, "domo-amplio": "17000" } }).length > 0);
      for (const invalid of [null, [], {}, { perNight: [] }]) assert(comparePublishedPricing(values, invalid).length > 0);
      values.set("BOOKING_ACTIVE_DOMES", "domo-amplio");
      assert(comparePublishedPricing(values, both).some((error: string) => error.includes("desactivado")));
    });
    await t.test("administrative cancellation requires authentication, confirmation, reason and financial acknowledgement", async () => {
      const cancellation = await import("../src/lib/admin-cancellation");
      const api = await import("../src/app/api/admin/reservations/[id]/route");
      const result = await service.startReservation(payload("2030-01-01", "2030-01-02"), null, "https://fixture.netlify.app");
      const input = { dome: "domo-amplio", reason: "Solicitud del huésped", acknowledged: true, acknowledgeNoRefund: true };
      const context = { params: Promise.resolve({ id: result.id }) };
      const request = (origin: string) => new Request("http://localhost/api/admin/reservations/" + result.id, {
        method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ action: "cancel", ...input }),
      });
      cookieValues.clear();
      assert.equal((await api.POST(request("http://localhost"), context)).status, 401);
      assert.equal((await api.POST(request("https://attacker.example"), context)).status, 403);
      for (const change of [{ reason: " " }, { reason: "ab" }, { acknowledged: false }, { acknowledgeNoRefund: false }]) {
        await assert.rejects(cancellation.cancelLocalReservation(result.id, { ...input, ...change }, "owner"), { status: 400 });
      }
      await assert.rejects(cancellation.cancelLocalReservation(result.id, { ...input, dome: "domo-romantico" }, "owner"), { status: 404 });
      await assert.rejects(cancellation.cancelLocalReservation(result.id, { ...input, start: "2030-01-01", end: "2030-01-03" }, "owner"), { status: 400 });
      assert.equal((await db.getBooking(result.id))!.status, "pending");
      const token = await auth.loginAdmin("owner", "A-private-test-password!", new Request("http://localhost"));
      cookieValues.set(auth.ADMIN_COOKIE, token);
      const response = await api.POST(request("http://localhost"), context);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("cache-control")!, /no-store/);
      assert((await response.json()).warning.includes("no realiza ni acredita un reembolso"));
      const row = (await db.getBooking(result.id))!;
      assert.equal(row.status, "cancelled"); assert.equal(row.cancelled_by, "owner");
      assert.equal(row.cancellation_reason, input.reason); assert(row.cancelled_at);
      assert.equal(row.cancelled_from_status, "pending"); assert(row.payment_link_closed_at);
      await auth.logoutAdmin(); cookieValues.clear();
    });
    await t.test("cancelling a paid reservation preserves money/history and cannot reactivate or release another booking", async () => {
      const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
      const result = await service.startReservation(payload("2030-02-01", "2030-02-02"), null, "https://fixture.netlify.app");
      const pending = (await db.getBooking(result.id))!;
      links.get(pending.payment_link_id!)!.approved = true;
      assert.equal((await service.reconcilePayment(result.id)).status, "confirmed");
      const beforeEmails = emailCalls;
      const beforePayments = createdPayments;
      const body = { dome: "domo-amplio", reason: "Cancelación acordada tras revisar el reembolso", acknowledged: true, acknowledgeNoRefund: true };
      await cancelLocalReservation(result.id, body, "owner");
      const cancelled = (await db.getBooking(result.id))!;
      assert.equal(cancelled.status, "cancelled"); assert.equal(cancelled.cancelled_from_status, "confirmed");
      assert.equal(cancelled.amount_cents, pending.amount_cents);
      assert.equal(cancelled.payment_reference, pending.payment_reference);
      assert(cancelled.confirmation_email_sent_at); assert(cancelled.owner_notification_sent_at);
      assert(!((await exportIcs()).includes(createHash("sha256").update(result.id).digest("hex"))));
      const replacement = await service.startReservation(payload("2030-02-01", "2030-02-02"), null, "https://fixture.netlify.app");
      const repeat = await cancelLocalReservation(result.id, { ...body, reason: "No reemplazar el motivo original" }, "another-admin");
      assert(repeat.alreadyCancelled);
      const afterRepeat = (await db.getBooking(result.id))!;
      assert.equal(afterRepeat.cancellation_reason, body.reason); assert.equal(afterRepeat.cancelled_by, "owner");
      const owners = await sql.query<{ reservation_id: string }>("SELECT reservation_id FROM reservation_nights WHERE dome='domo-amplio' AND night='2030-02-01'");
      assert.deepEqual(owners.rows.map((row) => row.reservation_id), [replacement.id]);
      const beforeChecks = detailCalls;
      assert.equal((await service.reconcilePayment(result.id)).status, "cancelled");
      assert.equal(detailCalls, beforeChecks); assert.equal(emailCalls, beforeEmails);
      assert.equal(createdPayments, beforePayments + 1);
    });
    await t.test("partial manual release atomically retains other nights and exports neither audit nor cancelled originals", async () => {
      const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
      const oldActive = process.env.BOOKING_ACTIVE_DOMES;
      try {
        process.env.BOOKING_ACTIVE_DOMES = "domo-romantico,domo-amplio";
        const original = await manual.createManualBlock({ dome: "domo-amplio", checkIn: "2030-03-01", checkOut: "2030-03-06", note: "PRIVATE maintenance" });
        const other = await manual.createManualBlock({ dome: "domo-romantico", checkIn: "2030-03-01", checkOut: "2030-03-06", note: "Otro domo" });
        const body = { dome: "domo-amplio", start: "2030-03-03", end: "2030-03-04", reason: "PRIVATE corrección del bloqueo", acknowledged: true };
        await assert.rejects(cancelLocalReservation(original, { ...body, start: "2030-02-28" }, "owner"), { status: 400 });
        await assert.rejects(cancelLocalReservation(original, { ...body, start: body.end }, "owner"), { status: 400 });
        const replies = await Promise.all([cancelLocalReservation(original, body, "owner"), cancelLocalReservation(original, body, "owner")]);
        assert.equal(replies.filter((reply) => reply.alreadyCancelled).length, 1);
        const children = await sql.query<{ id: string; check_in: string; check_out: string }>("SELECT id,check_in::text,check_out::text FROM reservations WHERE parent_block_id=$1 ORDER BY check_in", [original]);
        assert.deepEqual(children.rows.map((row) => [row.check_in, row.check_out]), [["2030-03-01", "2030-03-03"], ["2030-03-04", "2030-03-06"]]);
        const nights = await sql.query<{ night: string }>("SELECT night::text FROM reservation_nights WHERE dome='domo-amplio' AND night >= '2030-03-01' AND night < '2030-03-06' ORDER BY night");
        assert.deepEqual(nights.rows.map((row) => row.night), ["2030-03-01", "2030-03-02", "2030-03-04", "2030-03-05"]);
        assert.equal((await db.getBooking(other))!.status, "confirmed");
        const feed = await exportIcs();
        assert(!feed.includes("PRIVATE")); assert(!feed.includes(createHash("sha256").update(original).digest("hex")));
        assert.deepEqual(ical.parseIcal(feed).filter((range) => range.start >= "2030-03-01" && range.start < "2030-03-06").sort((a, b) => a.start.localeCompare(b.start)),
          [{ start: "2030-03-01", end: "2030-03-03" }, { start: "2030-03-04", end: "2030-03-06" }]);
        const calendar = await manual.adminCalendar("domo-amplio", "2030-03-01", "2030-04-01", false);
        const audit = calendar.reservations.find((row) => row.id === original)!;
        assert.equal(audit.cancellationStart, body.start); assert.equal(audit.cancellationEnd, body.end);
        assert.equal(audit.cancelledBy, "owner"); assert.equal(audit.cancellationReason, body.reason);
        // A disabled unit may still be cancelled safely; only creating new blocks is gated.
        process.env.BOOKING_ACTIVE_DOMES = "domo-amplio";
        await cancelLocalReservation(other, { dome: "domo-romantico", reason: "Bloqueo ya innecesario", acknowledged: true }, "owner");
        assert.equal((await db.getBooking(other))!.status, "cancelled");
      } finally { process.env.BOOKING_ACTIVE_DOMES = oldActive; }
    });
    await t.test("a failed partial release rolls back the original block, its audit and all night changes", async () => {
      const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
      const id = await manual.createManualBlock({ dome: "domo-amplio", checkIn: "2030-03-10", checkOut: "2030-03-15", note: "Mantenimiento" });
      failSplitInsert = true;
      try {
        await assert.rejects(cancelLocalReservation(id, { dome: "domo-amplio", start: "2030-03-12", end: "2030-03-13",
          reason: "Corrección de una noche", acknowledged: true }, "owner"));
      } finally { failSplitInsert = false; }
      const original = (await db.getBooking(id))!;
      assert.equal(original.status, "confirmed"); assert.equal(original.cancelled_at, null);
      assert.equal((await sql.query("SELECT night FROM reservation_nights WHERE reservation_id=$1", [id])).rows.length, 5);
      assert.equal((await sql.query("SELECT id FROM reservations WHERE parent_block_id=$1", [id])).rows.length, 0);
    });
    await t.test("cancellation and payment races never confirm released nights, and closure failures keep cancellation committed", async () => {
      const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
      const result = await service.startReservation(payload("2030-04-01", "2030-04-02"), null, "https://fixture.netlify.app");
      links.get((await db.getBooking(result.id))!.payment_link_id!)!.approved = true;
      const originalLog = console.error;
      console.error = () => {};
      try {
        closeLinkFailure = true;
        const outcomes = await Promise.allSettled([
          service.reconcilePayment(result.id),
          cancelLocalReservation(result.id, { dome: "domo-amplio", reason: "Cambio solicitado por el huésped", acknowledged: true, acknowledgeNoRefund: true }, "owner"),
        ]);
        assert.equal(outcomes[1].status, "fulfilled");
        if (outcomes[1].status === "fulfilled") assert(outcomes[1].value.warning.includes("No se pudo cerrar el enlace"));
        assert.equal((await db.getBooking(result.id))!.status, "cancelled");
        assert.equal((await sql.query("SELECT night FROM reservation_nights WHERE reservation_id=$1", [result.id])).rows.length, 0);
        assert.equal((await db.getBooking(result.id))!.payment_link_closed_at, null);
      } finally { closeLinkFailure = false; console.error = originalLog; }
    });
    await t.test("cancellation dialog discloses refund limits and allows partial dates only for manual blocks", async () => {
      const { createElement } = await import("react");
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { AdminCancellationDialog } = await import("../src/components/admin/AdminCancellationDialog");
      const target = { id: "00000000-0000-4000-8000-000000000099", dome: "domo-amplio", kind: "booking" as const,
        provider: "tilopay", name: "Fixture Guest", checkIn: "2030-06-01", checkOut: "2030-06-03" };
      const props = { target, domeName: "Domo Amplio", busy: false, error: "", onClose() {}, async onConfirm() {} };
      const booking = renderToStaticMarkup(createElement(AdminCancellationDialog, props));
      assert(booking.includes("no realiza ni acredita un reembolso")); assert(booking.includes("Motivo"));
      assert(!booking.includes('type="date"')); assert(booking.includes("Confirmar liberación"));
      assert(booking.includes("Liberar fechas")); assert(!booking.includes("Anular reserva"));
      const block = renderToStaticMarkup(createElement(AdminCancellationDialog, { ...props, target: { ...target, kind: "manual", provider: "manual" } }));
      assert.equal((block.match(/type="date"/g) ?? []).length, 2); assert(block.includes("Confirmar liberación"));
      assert(block.includes("Liberar fechas")); assert(!block.includes("Liberar noches del bloqueo"));
    });
    await t.test("calendar date details isolate each dome, ignore inactive attempts and exclude checkout nights", async () => {
      const { getAdminDayReservations, getAdminDaySources, isActiveAdminReservation } = await import("../src/lib/admin-calendar-view");
      const now = Date.parse("2031-05-01T12:00:00Z");
      const confirmed = adminReservationFixture();
      const live = adminReservationFixture({ id: "pending-live", status: "pending", expiresAt: new Date(now + 60_000).toISOString() });
      const manualBlock = adminReservationFixture({ id: "manual", kind: "manual", provider: "manual" });
      const other = adminReservationFixture({ id: "other-dome", dome: "domo-romantico" });
      const rows = [confirmed, live, manualBlock, other,
        adminReservationFixture({ status: "expired" }), adminReservationFixture({ status: "cancelled" }),
        adminReservationFixture({ status: "pending", expiresAt: new Date(now - 1).toISOString() }),
        adminReservationFixture({ status: "pending", expiresAt: "invalid" })];
      assert.deepEqual(getAdminDayReservations(rows, "domo-amplio", "2031-06-01", now), [confirmed, live, manualBlock]);
      assert.deepEqual(getAdminDayReservations(rows, "domo-romantico", "2031-06-02", now), [other]);
      for (const day of ["2031-06-03", "2031-05-31", "invalid", "2031-02-31"]) {
        assert.deepEqual(getAdminDayReservations(rows, "domo-amplio", day, now), []);
      }
      assert.equal(isActiveAdminReservation(live, now + 60_000), false);
      const external = [{ name: "Expedia" as const, status: "ready" as const,
        blocked: [{ start: "2031-06-01", end: "2031-06-03" }], checkedAt: null }];
      assert.deepEqual(getAdminDaySources(external, "2031-06-01"), external);
      assert.deepEqual(getAdminDaySources(external, "2031-06-03"), []);
      assert.deepEqual(getAdminDaySources(external, "invalid"), []);
    });
    await t.test("private date popover shows actual guest details, escapes text and uses one release action", async () => {
      const { createElement } = await import("react");
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { AdminDayDetailsPopover } = await import("../src/components/admin/AdminDayDetailsPopover");
      const row = adminReservationFixture({ name: "Guest <script>alert(1)</script>" });
      const props = { anchor: {} as HTMLButtonElement, day: "2031-06-01", dome: "domo-amplio", domeName: "Domo Amplio",
        reservations: [row, adminReservationFixture({ dome: "domo-romantico", name: "Other Property Guest" }),
          adminReservationFixture({ status: "cancelled", name: "Cancelled Guest" })],
        sources: [], environment: "Test", busy: false, onClose() {}, onRelease() {} };
      const html = renderToStaticMarkup(createElement(AdminDayDetailsPopover, props));
      assert(html.includes('role="dialog"')); assert(html.includes("Cerrar detalles de la fecha"));
      assert(html.includes("&lt;script&gt;")); assert(!html.includes("<script>"));
      assert(html.includes("guest@example.com")); assert(html.includes("+50688888888"));
      assert(html.includes("2 huéspedes")); assert(html.includes("Costa Rica")); assert(html.includes("2 noches"));
      assert(html.includes("340")); assert(html.includes("Sin cargo real"));
      assert(!html.includes("Other Property Guest")); assert(!html.includes("Cancelled Guest"));
      assert.equal((html.match(/>Liberar fechas</g) ?? []).length, 1);
      assert(!html.includes("Anular reserva"));
      const block = renderToStaticMarkup(createElement(AdminDayDetailsPopover, { ...props,
        reservations: [adminReservationFixture({ kind: "manual", provider: "manual", note: "Mantenimiento" })] }));
      assert(block.includes("Bloqueo manual")); assert(block.includes("Mantenimiento"));
      assert(!block.includes("guest@example.com")); assert(!block.includes("Huéspedes y residencia"));
      assert.equal((block.match(/>Liberar fechas</g) ?? []).length, 1);
    });
    await t.test("imported-only date details never invent guest information or allow external cancellation", async () => {
      const { createElement } = await import("react");
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { AdminDayDetailsPopover } = await import("../src/components/admin/AdminDayDetailsPopover");
      const html = renderToStaticMarkup(createElement(AdminDayDetailsPopover, {
        anchor: {} as HTMLButtonElement, day: "2031-06-01", dome: "domo-amplio", domeName: "Domo Amplio",
        reservations: [adminReservationFixture({ dome: "domo-romantico", name: "Private Foreign Guest" })],
        sources: [{ name: "Airbnb", status: "ready", blocked: [{ start: "2031-06-01", end: "2031-06-03" }], checkedAt: null }],
        environment: "Test", busy: false, onClose() {}, onRelease() {},
      }));
      assert(html.includes("Airbnb")); assert(html.includes("iCal no proporciona los datos de huéspedes"));
      assert(!html.includes("Private Foreign Guest")); assert(!html.includes("guest@example.com"));
      assert(!html.includes('href="mailto:')); assert(!html.includes(">Liberar fechas<"));
    });
    await t.test("a paid single-use cancellation is verified as consumed, not falsely closed or retried forever", async () => {
      const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
      const { GET: status } = await import("../src/app/api/reservations/[id]/route");
      const created = await service.startReservation(payload("2032-01-01", "2032-01-02"), null, "https://fixture.netlify.app");
      const pending = (await db.getBooking(created.id))!;
      links.get(pending.payment_link_id!)!.approved = true;
      await service.reconcilePayment(created.id);
      const beforeClose = closedLinks, beforePayments = createdPayments, beforeEmails = emailCalls;
      try {
        linkTypeFixture = "Single use"; closeLinkFailure = true;
        const result = await cancelLocalReservation(created.id, { dome: "domo-amplio", reason: "Anulación de reserva pagada", acknowledged: true, acknowledgeNoRefund: true }, "owner");
        assert(!result.warning.includes("No se pudo cerrar"));
        const row = (await db.getBooking(created.id))!;
        assert.equal(row.status, "cancelled"); assert(row.payment_link_consumed_at);
        assert.equal(row.payment_link_closed_at, null); assert.equal(row.payment_link_error, null);
        assert.equal(row.amount_cents, pending.amount_cents); assert.equal(row.payment_reference, pending.payment_reference);
        assert.equal(closedLinks, beforeClose); assert.equal(createdPayments, beforePayments); assert.equal(emailCalls, beforeEmails);
        assert.equal((await sql.query("SELECT night FROM reservation_nights WHERE reservation_id=$1", [created.id])).rows.length, 0);
        const beforeDetails = detailCalls;
        await payments.closeInactivePaymentLink(row);
        await payments.closeInactivePaymentLink({ ...row, payment_link_consumed_at: null }); // stale caller still cannot claim it
        assert.equal(detailCalls, beforeDetails);
        const view = await manual.adminCalendar("domo-amplio", "2032-01-01", "2032-02-01", false);
        const visible = view.reservations.find(item => item.id === row.id)!;
        assert.equal(visible.paymentLinkState, "consumed"); assert.equal(visible.paymentLinkPending, false);
        const publicResult = await status(new Request("http://localhost"), { params: Promise.resolve({ id: row.id }) });
        const publicBody = await publicResult.text();
        for (const field of ["paymentLink", "payment_link", "diagnostic", "fixture-password"]) assert(!publicBody.includes(field));
        assert(!((await exportIcs()).includes(createHash("sha256").update(row.id).digest("hex"))));
      } finally { linkTypeFixture = undefined; closeLinkFailure = false; }
    });
    await t.test("unlimited or unknown links are never inferred consumed from a previously confirmed reservation", async () => {
      const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
      try {
        for (const [index, type] of ["Unlimited", undefined].entries()) {
          const created = await service.startReservation(payload(`2032-02-0${index + 1}`, `2032-02-0${index + 2}`), null, "https://fixture.netlify.app");
          links.get((await db.getBooking(created.id))!.payment_link_id!)!.approved = true;
          await service.reconcilePayment(created.id);
          linkTypeFixture = type; closeFixture = "numeric";
          const before = closedLinks;
          await cancelLocalReservation(created.id, { dome: "domo-amplio", reason: "Anulación acordada", acknowledged: true, acknowledgeNoRefund: true }, "owner");
          const row = (await db.getBooking(created.id))!;
          assert(row.payment_link_closed_at); assert.equal(row.payment_link_consumed_at, null);
          assert.equal(closedLinks, before + 1);
        }
      } finally { linkTypeFixture = undefined; closeFixture = "normal"; }
    });
    await t.test("closure errors persist safe diagnostics, respect cooldown and recover without reactivating nights", async () => {
      const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
      const originalLog = console.error; let logged = "";
      console.error = (...args) => { logged += JSON.stringify(args); };
      try {
        for (const [index, mode] of (["reject", "status-zero", "http", "timeout"] as const).entries()) {
          const created = await service.startReservation(payload(`2032-03-0${index + 1}`, `2032-03-0${index + 2}`), null, "https://fixture.netlify.app");
          closeLinkFailure = mode === "reject"; closeFixture = mode === "reject" ? "normal" : mode;
          await cancelLocalReservation(created.id, { dome: "domo-amplio", reason: "Corrección de solicitud", acknowledged: true, acknowledgeNoRefund: true }, "owner");
          const row = (await db.getBooking(created.id))!;
          assert.equal(row.status, "cancelled"); assert.equal(row.payment_link_closed_at, null); assert.equal(row.payment_link_consumed_at, null);
          assert(row.payment_link_error); assert.equal(row.payment_link_error.stage, "tilopay_close");
          assert.match(row.payment_link_error.reference, /^[a-f0-9-]{36}$/);
          assert.equal(row.payment_link_error.reason, mode === "http" ? "http" : mode === "timeout" ? "timeout" : "rejected");
          if (mode === "http") assert.equal(row.payment_link_error.upstreamStatus, 401);
          if (mode === "reject") assert.equal(row.payment_link_error.providerCode, "503");
          if (mode === "status-zero") assert.equal(row.payment_link_error.providerStatus, "0");
          assert.equal((await sql.query("SELECT night FROM reservation_nights WHERE reservation_id=$1", [row.id])).rows.length, 0);
          const before = closedLinks;
          await payments.closeInactivePaymentLink(row);
          assert.equal(closedLinks, before, "An immediate manual/worker retry must not duplicate the provider request.");
          closeLinkFailure = false; closeFixture = "numeric";
          await sql.query("UPDATE reservations SET payment_link_checked_at=now()-interval '3 minutes' WHERE id=$1", [row.id]);
          await Promise.all([payments.closeInactivePaymentLink(row), payments.closeInactivePaymentLink(row)]);
          assert.equal(closedLinks, before + 1, "Two serverless callers share an atomic claim.");
          const recovered = (await db.getBooking(row.id))!;
          assert.equal(recovered.status, "cancelled"); assert(recovered.payment_link_closed_at); assert.equal(recovered.payment_link_error, null);
        }
        for (const secret of ["fixture-password", "Private provider", "guest@example.com", "getDetailLinkPayment/"]) assert(!logged.includes(secret));
        assert(logged.includes('"stage":"tilopay_close"')); assert(logged.includes('"providerCode":"503"'));
      } finally { console.error = originalLog; closeLinkFailure = false; closeFixture = "normal"; }
    });
    await t.test("single-use consumption requires the matching captured payment, correct environment and exact link", async () => {
      const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
      const originalLog = console.error; console.error = () => {};
      try {
        for (const [index, failure] of ["wrong_environment", "wrong_capture", "unrelated", "wrong_reference"].entries()) {
          const created = await service.startReservation(payload(`2032-04-0${index + 1}`, `2032-04-0${index + 2}`), null, "https://fixture.netlify.app");
          links.get((await db.getBooking(created.id))!.payment_link_id!)!.approved = true;
          await service.reconcilePayment(created.id);
          linkTypeFixture = 1; closeLinkFailure = true;
          if (failure === "wrong_reference") detailFixture = "wrong_reference";
          else transactionFixture = failure as typeof transactionFixture;
          await cancelLocalReservation(created.id, { dome: "domo-amplio", reason: "Revisión del pago", acknowledged: true, acknowledgeNoRefund: true }, "owner");
          const row = (await db.getBooking(created.id))!;
          assert.equal(row.status, "cancelled"); assert.equal(row.payment_link_consumed_at, null); assert.equal(row.payment_link_closed_at, null);
          assert(row.payment_link_error);
          detailFixture = "live"; transactionFixture = "success"; closeLinkFailure = false; linkTypeFixture = undefined;
        }
      } finally { console.error = originalLog; linkTypeFixture = undefined; closeLinkFailure = false; detailFixture = "live"; transactionFixture = "success"; }
    });
    await t.test("admin can inspect/retry an inactive link with authentication, dome isolation and safe failures", async () => {
      const api = await import("../src/app/api/admin/reservations/[id]/route");
      const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
      const created = await service.startReservation(payload("2032-05-01", "2032-05-02"), null, "https://fixture.netlify.app");
      const context = { params: Promise.resolve({ id: created.id }) };
      const request = (dome = "domo-amplio", origin = "http://localhost") => new Request("http://localhost/api/admin/reservations/" + created.id, {
        method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry-payment-link", dome }),
      });
      cookieValues.clear();
      assert.equal((await api.POST(request(), context)).status, 401);
      assert.equal((await api.POST(request("domo-amplio", "https://attacker.example"), context)).status, 403);
      const token = await auth.loginAdmin("owner", "A-private-test-password!", new Request("http://localhost"));
      cookieValues.set(auth.ADMIN_COOKIE, token);
      const originalLog = console.error; console.error = () => {};
      try {
        assert.equal((await api.POST(request("domo-romantico"), context)).status, 404);
        assert.equal((await api.POST(request(), context)).status, 409);
        closeLinkFailure = true;
        await cancelLocalReservation(created.id, { dome: "domo-amplio", reason: "Anulación de solicitud", acknowledged: true, acknowledgeNoRefund: true }, "owner");
        const before = closedLinks;
        assert.equal((await api.POST(request(), context)).status, 200);
        assert.equal(closedLinks, before);
        await sql.query("UPDATE reservations SET payment_link_checked_at=now()-interval '3 minutes' WHERE id=$1", [created.id]);
        const failure = await api.POST(request(), context);
        assert.equal(failure.status, 502); assert.match(failure.headers.get("cache-control")!, /private.*no-store/);
        assert(!((await failure.text()).includes("fixture-password")));
        const calendar = await manual.adminCalendar("domo-amplio", "2032-05-01", "2032-06-01", false);
        const item = calendar.reservations.find(row => row.id === created.id)!;
        assert.equal(item.paymentLinkState, "pending"); assert(item.paymentLinkDiagnostic?.reference); assert(item.paymentLinkPending);
        closeLinkFailure = false;
        await sql.query("UPDATE reservations SET payment_link_checked_at=now()-interval '3 minutes' WHERE id=$1", [created.id]);
        const success = await api.POST(request(), context);
        assert.equal(success.status, 200); assert((await success.json()).warning.includes("Enlace cerrado"));
        assert.equal((await db.getBooking(created.id))!.status, "cancelled");
      } finally { console.error = originalLog; closeLinkFailure = false; await auth.logoutAdmin(); cookieValues.clear(); }
    });
    await t.test("owner messages distinguish consumed, closed and uncertain links without inventing payment/refund state", async () => {
      const { createElement } = await import("react");
      const { renderToStaticMarkup } = await import("react-dom/server");
      const { AdminPaymentLinkStatus } = await import("../src/components/admin/AdminPaymentLinkStatus");
      const render = (state: AdminReservation["paymentLinkState"]) => renderToStaticMarkup(createElement(AdminPaymentLinkStatus, {
        row: adminReservationFixture({ status: "cancelled", paymentLinkState: state, paymentLinkDiagnostic: state === "pending"
          ? { stage: "tilopay_close", reason: "rejected", providerCode: "503", reference: "00000000-0000-4000-8000-000000000009" } : null }),
      }));
      assert.equal(render(null), "");
      assert(render("consumed").includes("pago verificado y uso consumido"));
      assert(!render("consumed").includes("pendiente"));
      assert(render("closed").includes("Enlace de pago cerrado"));
      assert(render("pending").includes("no demuestra que el enlace permita otro pago"));
      assert(render("pending").includes("Código Tilopay: 503")); assert(render("pending").includes("Información para soporte"));
      assert(!render("pending").includes("guest@example.com"));
    });
    await t.test("database connections are bounded and idle errors never expose private driver messages", async () => {
      assert.equal(poolOptions.max, 3);
      assert.equal(poolOptions.connectionTimeoutMillis, 10_000);
      assert.equal(poolOptions.idleTimeoutMillis, 10_000);
      assert.equal(poolOptions.allowExitOnIdle, true);
      assert(idleErrorHandler);
      const originalLog = console.error;
      let logged = "";
      console.error = (...args) => { logged += JSON.stringify(args); };
      try { idleErrorHandler(Object.assign(new Error("Private connection URL password guest@example.com"), { code: "08006" })); }
      finally { console.error = originalLog; }
      assert(logged.includes("08006"));
      assert(!logged.includes("password")); assert(!logged.includes("guest@example.com"));
    });
    await t.test("viewing admin calendars is read-only and expired nights remain safely reusable", async () => {
      const original = await service.startReservation(payload("2029-09-01", "2029-09-02"), null, "https://fixture.netlify.app");
      await sql.query("UPDATE reservations SET expires_at = now() - interval '1 minute' WHERE id = $1", [original.id]);
      const before = executedSql.length;
      const calendar = await manual.adminCalendar("domo-amplio", "2029-09-01", "2029-10-01", false);
      const statements = executedSql.slice(before);
      assert.equal(statements.length, 3);
      assert(statements.every((statement) => /^SELECT\s/.test(statement)));
      assert.equal(calendar.reservations.find((row) => row.id === original.id)!.status, "expired");
      assert.equal((await db.getBooking(original.id))!.status, "pending", "Viewing must not write back expired states.");
      const replacement = await service.startReservation(payload("2029-09-01", "2029-09-02"), null, "https://fixture.netlify.app");
      assert.equal((await db.getBooking(original.id))!.status, "expired");
      const nights = await sql.query<{ reservation_id: string }>("SELECT reservation_id FROM reservation_nights WHERE night='2029-09-01' AND dome='domo-amplio'");
      assert.deepEqual(nights.rows.map((row) => row.reservation_id), [replacement.id]);
    });
    await t.test("owner-set prices parse exact cents and reject invalid dates or unsafe amounts", async () => {
      const { parseNightPrice, validatePriceRange } = await import("../src/lib/nightly-pricing");
      for (const [value, cents] of [["170", 17000], ["200,25", 20025], ["0.01", 1], [" 125.5 ", 12550]] as const) {
        assert.equal(parseNightPrice(value), cents);
      }
      for (const value of [0, 170, "0", "-1", "1.001", "NaN", "Infinity", "1e2", "1000000.01", "<script>"]) {
        assert.throws(() => parseNightPrice(value), { status: 400 });
      }
      for (const [start, end] of [["2034-02-30", "2034-03-01"], ["2034-01-01", "2034-01-01"], ["2034-01-02", "2034-01-01"], ["2034-01-01", "2035-01-02"]]) {
        assert.throws(() => validatePriceRange(start, end, 365), { status: 400 });
      }
    });
    await t.test("bulk pricing saves an entire range atomically, isolates domes and restores only selected nights", async () => {
      const { changeNightPrices, adminPrices } = await import("../src/lib/admin-pricing");
      const oldRomantic = process.env.PRICE_DOMO_ROMANTICO_CENTS;
      process.env.PRICE_DOMO_ROMANTICO_CENTS = "17000";
      const span = { dome: "domo-amplio", start: "2034-01-01", end: "2035-01-01", price: "200.25" };
      try {
        await changeNightPrices(span, "fixture-owner");
        const count = await sql.query<{ count: number }>("SELECT count(*)::int AS count FROM nightly_prices WHERE dome='domo-amplio'");
        assert.equal(count.rows[0].count, 365);
        const first = (await adminPrices("domo-amplio", "2033-12-31", "2034-01-03"))!;
        assert.deepEqual(first.nights.map((night) => night.amountCents), [12500, 20025, 20025]);
        const last = (await adminPrices("domo-amplio", "2034-12-31", "2035-01-02"))!;
        assert.deepEqual(last.nights.map((night) => night.amountCents), [20025, 12500]);
        assert.equal((await adminPrices("domo-romantico", "2034-01-01", "2034-01-03"))!.amountCents, 34000);
        await changeNightPrices({ ...span, start: "2034-01-02", end: "2034-01-04", price: "250" }, "fixture-owner");
        await changeNightPrices({ ...span, start: "2034-01-03", end: "2034-01-04" }, "fixture-owner", true);
        const mixed = (await adminPrices("domo-amplio", "2034-01-01", "2034-01-05"))!;
        assert.deepEqual(mixed.nights.map((night) => night.amountCents), [20025, 25000, 12500, 20025]);
        assert.deepEqual(mixed.nights.map((night) => night.special), [true, true, false, true]);
        const before = mixed.amountCents;
        failPriceWrite = true;
        await assert.rejects(changeNightPrices({ ...span, end: "2034-01-05", price: "300" }, "fixture-owner"));
        assert.equal((await adminPrices("domo-amplio", "2034-01-01", "2034-01-05"))!.amountCents, before, "A failed bulk save must roll back every night.");
        await assert.rejects(changeNightPrices({ ...span, start: "2020-01-01", end: "2020-01-02" }, "fixture-owner"), { status: 400 });
        await assert.rejects(changeNightPrices({ ...span, dome: "unknown" }, "fixture-owner"), { status: 400 });
      } finally {
        await sql.exec("DELETE FROM nightly_prices");
        if (oldRomantic === undefined) delete process.env.PRICE_DOMO_ROMANTICO_CENTS; else process.env.PRICE_DOMO_ROMANTICO_CENTS = oldRomantic;
      }
    });
    await t.test("public night prices contain only prices, sum exact chosen nights and fail closed on storage failure", async () => {
      const prices = await import("../src/lib/admin-pricing");
      const api = await import("../src/app/api/pricing/[dome]/route");
      const query = (start: string, end: string, dome = "domo-amplio") => api.GET(
        new Request(`http://localhost/api/pricing/${dome}?${new URLSearchParams({ start, end })}`), { params: Promise.resolve({ dome }) });
      try {
        await prices.changeNightPrices({ dome: "domo-amplio", start: "2034-02-01", end: "2034-02-03", price: "200.25" }, "private-owner");
        const response = await query("2034-02-01", "2034-02-04");
        assert.equal(response.status, 200); assert.match(response.headers.get("cache-control")!, /no-store/);
        const quote = await response.json();
        assert.equal(quote.amountCents, 20025 + 20025 + 12500);
        assert.deepEqual(quote.nights.map((night: { date: string }) => night.date), ["2034-02-01", "2034-02-02", "2034-02-03"]);
        assert(!JSON.stringify(quote).includes("private-owner")); assert(!JSON.stringify(quote).includes("updated"));
        assert(!JSON.stringify(quote).includes("guest"));
        assert.equal((await query("2034-02-30", "2034-03-01")).status, 400);
        assert.equal((await query("2034-01-01", "2035-01-01")).status, 400);
        assert.equal((await query("2034-02-01", "2034-02-02", "unknown")).status, 404);
        const oldLog = console.error; let log = "";
        console.error = (...args) => { log += JSON.stringify(args); };
        try {
          failPriceRead = true;
          const failed = await query("2034-02-01", "2034-02-02");
          assert.equal(failed.status, 503); assert(!(await failed.text()).includes("Fixture private"));
          assert(!log.includes("Fixture private"));
        } finally { console.error = oldLog; }
      } finally { await sql.exec("DELETE FROM nightly_prices"); }
    });
    await t.test("bulk price endpoints require admin and same origin; authenticated save and restore work", async () => {
      const api = await import("../src/app/api/admin/prices/route");
      const request = (origin = "http://localhost", body: unknown = { dome: "domo-amplio", start: "2034-03-01", end: "2034-03-04", price: "195" }) =>
        new Request("http://localhost/api/admin/prices", { method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
      cookieValues.clear();
      for (const handler of [api.PUT, api.DELETE]) {
        assert.equal((await handler(request())).status, 401);
        assert.equal((await handler(request("https://attacker.invalid"))).status, 403);
      }
      await sql.exec("DELETE FROM admin_login_limits");
      const token = await auth.loginAdmin("owner", "A-private-test-password!", new Request("http://localhost"));
      cookieValues.set(auth.ADMIN_COOKIE, token);
      try {
        const saved = await api.PUT(request()); assert.equal(saved.status, 200);
        assert.match(saved.headers.get("cache-control")!, /private, no-store/);
        assert.equal((await sql.query("SELECT night FROM nightly_prices WHERE dome='domo-amplio'")).rows.length, 3);
        assert.equal((await api.PUT(request("http://localhost", { dome: "domo-amplio", start: "2034-03-01", end: "2034-03-04", price: "0" }))).status, 400);
        assert.equal((await api.DELETE(request())).status, 200);
        assert.equal((await sql.query("SELECT night FROM nightly_prices")).rows.length, 0);
      } finally { await auth.logoutAdmin(); cookieValues.clear(); await sql.exec("DELETE FROM nightly_prices"); }
    });
    await t.test("checkout enforces owner-set rates under lock and freezes existing payment amounts and nightly breakdown", async () => {
      const { changeNightPrices } = await import("../src/lib/admin-pricing");
      const data = payload("2034-04-01", "2034-04-04");
      try {
        await changeNightPrices({ dome: "domo-amplio", start: "2034-04-01", end: "2034-04-03", price: "210.25" }, "owner");
        const before = createdPayments;
        await assert.rejects(service.startReservation(data, null, "https://fixture.netlify.app"), { status: 409 });
        assert.equal(createdPayments, before);
        assert.equal((await sql.query("SELECT id FROM reservations WHERE check_in='2034-04-01'")).rows.length, 0);
        const amount = 21025 + 21025 + 12500;
        failPriceRead = true;
        await assert.rejects(service.startReservation({ ...data, expectedAmountCents: amount }, null, "https://fixture.netlify.app"));
        assert.equal(createdPayments, before, "Unknown prices must never open a payment.");
        assert.equal((await sql.query("SELECT id FROM reservations WHERE check_in='2034-04-01'")).rows.length, 0);
        const statementsStart = executedSql.length;
        const result = await service.startReservation({ ...data, expectedAmountCents: amount }, null, "https://fixture.netlify.app");
        assert.equal(result.amountCents, amount); assert.equal(paymentBody!.amount, "545.50");
        const statements = executedSql.slice(statementsStart);
        const lock = statements.findIndex((statement) => statement.includes("rate_calendars") && statement.includes("FOR UPDATE"));
        const read = statements.findIndex((statement) => statement.includes("FROM nightly_prices"));
        const insert = statements.findIndex((statement) => statement.startsWith("INSERT INTO reservations"));
        assert(lock > 0 && read > lock && insert > read);
        const snapshot = (await sql.query<{ nightly_prices: unknown[] }>("SELECT nightly_prices FROM reservations WHERE id=$1", [result.id])).rows[0].nightly_prices;
        assert.equal(snapshot.length, 3);
        await changeNightPrices({ dome: "domo-amplio", start: "2034-04-01", end: "2034-04-04", price: "300" }, "owner");
        const booking = (await db.getBooking(result.id))!;
        assert.equal(booking.amount_cents, amount);
        links.get(booking.payment_link_id!)!.approved = true;
        assert.equal((await service.reconcilePayment(result.id)).status, "confirmed");
        assert.equal((await db.getBooking(result.id))!.amount_cents, amount);
        assert.deepEqual((await sql.query<{ nightly_prices: unknown[] }>("SELECT nightly_prices FROM reservations WHERE id=$1", [result.id])).rows[0].nightly_prices, snapshot);
      } finally { await sql.exec("DELETE FROM nightly_prices"); }
    });
    await t.test("scheduled retries retain safety, skip recorded payment incidents and independently close expired links", async () => {
      // This is the disposable fixture database. Isolate the worker from all
      // earlier test reservations; no real database is accessed by this suite.
      await sql.exec("TRUNCATE reservations CASCADE");
      const worker = await import("../src/app/api/internal/reconcile/route");
      const savedEnabled = process.env.BOOKING_RECONCILE_ENABLED;
      const savedSecret = process.env.BOOKING_RECONCILE_SECRET;
      const originalLog = console.error;
      const secret = "fixture-reconciliation-secret-".repeat(2);
      const request = (provided = secret) => new Request("http://localhost/api/internal/reconcile", {
        method: "POST", headers: { "x-reconcile-secret": provided },
      });
      const run = async () => {
        const response = await worker.POST(request());
        assert.equal(response.status, 200);
        return response.json() as Promise<{ checked: number; emailRetries: number; failures: number }>;
      };
      console.error = () => {};
      try {
        process.env.BOOKING_RECONCILE_SECRET = secret;
        process.env.BOOKING_RECONCILE_ENABLED = "false";
        const before = executedSql.length;
        assert.equal((await worker.POST(request())).status, 204);
        process.env.BOOKING_RECONCILE_ENABLED = "true";
        assert.equal((await worker.POST(request("wrong"))).status, 404);
        assert.equal(executedSql.length, before);
        assert.deepEqual(await run(), { checked: 0, emailRetries: 0, failures: 0 });

        const paid = await service.startReservation(payload("2029-10-01", "2029-10-02"), null, "https://fixture.netlify.app");
        const paidRow = (await db.getBooking(paid.id))!;
        links.get(paidRow.payment_link_id!)!.approved = true;
        const beforeEmails = emailCalls;
        smtpFailedAudience = "owner";
        await run();
        assert.equal((await db.getBooking(paid.id))!.status, "confirmed");
        assert((await db.getBooking(paid.id))!.confirmation_email_sent_at);
        assert.equal((await db.getBooking(paid.id))!.owner_notification_sent_at, null);
        smtpFailedAudience = null;
        const beforeRetry = emailCalls;
        const retry = await run();
        assert.equal(retry.emailRetries, 1);
        assert.equal(emailCalls, beforeRetry + 1);
        assert(emailCalls > beforeEmails);
        assert((await db.getBooking(paid.id))!.owner_notification_sent_at);

        const incident = await service.startReservation(payload("2029-10-03", "2029-10-04"), null, "https://fixture.netlify.app");
        await db.expireBooking(incident.id);
        const incidentRow = (await db.getBooking(incident.id))!;
        links.get(incidentRow.payment_link_id!)!.approved = true;
        await assert.rejects(service.reconcilePayment(incident.id), { status: 409 });
        const beforeDetails = detailCalls;
        const beforeClose = closedLinks;
        closeLinkFailure = true;
        assert.equal((await run()).failures, 1);
        assert.equal(detailCalls, beforeDetails);
        assert.equal((await db.getBooking(incident.id))!.payment_link_closed_at, null);
        closeLinkFailure = false;
        await sql.query("UPDATE reservations SET payment_link_checked_at = now() - interval '3 minutes' WHERE id = $1", [incident.id]);
        assert.equal((await run()).failures, 0);
        assert.equal(detailCalls, beforeDetails);
        assert.equal(closedLinks, beforeClose + 2);
        assert((await db.getBooking(incident.id))!.payment_link_closed_at);
        assert((await db.getBooking(incident.id))!.payment_issue, "The owner must still see the incident.");
        assert.equal((await run()).checked, 0);

        const late = await service.startReservation(payload("2029-10-05", "2029-10-06"), null, "https://fixture.netlify.app");
        await db.expireBooking(late.id);
        links.get((await db.getBooking(late.id))!.payment_link_id!)!.approved = true;
        await run();
        const lateRow = (await db.getBooking(late.id))!;
        assert.equal(lateRow.status, "expired");
        assert(lateRow.payment_issue); assert(lateRow.payment_link_closed_at);

        const old = await service.startReservation(payload("2029-10-07", "2029-10-08"), null, "https://fixture.netlify.app");
        await db.expireBooking(old.id);
        await sql.query("UPDATE reservations SET created_at = now() - interval '8 days' WHERE id = $1", [old.id]);
        const beforeOldDetails = detailCalls;
        await run();
        assert.equal(detailCalls, beforeOldDetails);
        assert((await db.getBooking(old.id))!.payment_link_closed_at);
        assert.equal((await run()).checked, 0);

        const cancelled = await service.startReservation(payload("2030-05-01", "2030-05-02"), null, "https://fixture.netlify.app");
        const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
        closeLinkFailure = true;
        await cancelLocalReservation(cancelled.id, { dome: "domo-amplio", reason: "Cambio de fechas solicitado", acknowledged: true, acknowledgeNoRefund: true }, "owner");
        const cancelledRow = (await db.getBooking(cancelled.id))!;
        assert.equal(cancelledRow.status, "cancelled"); assert.equal(cancelledRow.payment_link_closed_at, null);
        links.get(cancelledRow.payment_link_id!)!.approved = true;
        closeLinkFailure = false;
        await sql.query("UPDATE reservations SET payment_link_checked_at = now() - interval '3 minutes' WHERE id = $1", [cancelled.id]);
        await run();
        const lateCancelled = (await db.getBooking(cancelled.id))!;
        assert.equal(lateCancelled.status, "cancelled");
        assert(lateCancelled.payment_issue?.includes("reserva anulada")); assert(lateCancelled.payment_link_closed_at);
        assert.equal((await sql.query("SELECT night FROM reservation_nights WHERE reservation_id=$1", [cancelled.id])).rows.length, 0);

        const confirmedCancellation = await service.startReservation(payload("2030-05-03", "2030-05-04"), null, "https://fixture.netlify.app");
        links.get((await db.getBooking(confirmedCancellation.id))!.payment_link_id!)!.approved = true;
        await service.reconcilePayment(confirmedCancellation.id);
        closeLinkFailure = true;
        await cancelLocalReservation(confirmedCancellation.id, { dome: "domo-amplio", reason: "Cancelación acordada con el huésped", acknowledged: true, acknowledgeNoRefund: true }, "owner");
        closeLinkFailure = false;
        await sql.query("UPDATE reservations SET payment_link_checked_at = now() - interval '3 minutes' WHERE id = $1", [confirmedCancellation.id]);
        const beforeKnownChecks = detailCalls;
        await run();
        const knownCancelled = (await db.getBooking(confirmedCancellation.id))!;
        assert.equal(knownCancelled.status, "cancelled"); assert.equal(knownCancelled.payment_issue, null);
        assert(knownCancelled.payment_link_closed_at); assert.equal(detailCalls, beforeKnownChecks + 1);
        assert.equal((await run()).checked, 0);
        const consumedCancellation = await service.startReservation(payload("2030-05-05", "2030-05-06"), null, "https://fixture.netlify.app");
        links.get((await db.getBooking(consumedCancellation.id))!.payment_link_id!)!.approved = true;
        await service.reconcilePayment(consumedCancellation.id);
        linkTypeFixture = "Single use";
        await cancelLocalReservation(consumedCancellation.id, { dome: "domo-amplio", reason: "Cancelación de enlace consumido", acknowledged: true, acknowledgeNoRefund: true }, "owner");
        assert((await db.getBooking(consumedCancellation.id))!.payment_link_consumed_at);
        const consumedDetails = detailCalls;
        assert.equal((await run()).checked, 0); assert.equal(detailCalls, consumedDetails);
        linkTypeFixture = undefined;
        assert(readFileSync("netlify/functions/reconcile-reservations.mts", "utf8").includes('schedule: "*/15 * * * *"'));
      } finally {
        console.error = originalLog; smtpFailedAudience = null; closeLinkFailure = false; linkTypeFixture = undefined;
        for (const [key, value] of [["BOOKING_RECONCILE_ENABLED", savedEnabled], ["BOOKING_RECONCILE_SECRET", savedSecret]]) {
          if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
        }
      }
    });
    await t.test("scheduled function exposes safe failure summaries without leaking provider data", async () => {
      const { default: run } = await import("../netlify/functions/reconcile-reservations.mjs");
      const savedFetch = globalThis.fetch, savedWarn = console.warn;
      const savedEnabled = process.env.BOOKING_RECONCILE_ENABLED;
      const savedSecret = process.env.BOOKING_RECONCILE_SECRET;
      let mode = "failures", warnings = "";
      globalThis.fetch = async (_url, init) => {
        assert.equal(init?.method, "POST");
        if (mode === "disabled") return new Response(null, { status: 204 });
        if (mode === "http") return new Response(null, { status: 503 });
        return Response.json(mode === "invalid" ? {} : { failures: mode === "failures" ? 2 : 0, private: "fixture-password" });
      };
      console.warn = (...args) => { warnings += JSON.stringify(args); };
      try {
        process.env.BOOKING_RECONCILE_ENABLED = "true";
        process.env.BOOKING_RECONCILE_SECRET = "private-fixture-worker-only";
        assert.equal((await run()).status, 204);
        assert(warnings.includes('"failures":2')); assert(!warnings.includes("fixture-password"));
        assert(!warnings.includes(process.env.BOOKING_RECONCILE_SECRET));
        mode = "http"; await assert.rejects(run(), /HTTP 503/);
        mode = "invalid"; await assert.rejects(run(), /Invalid booking reconciliation report/);
        mode = "disabled"; assert.equal((await run()).status, 204);
      } finally {
        globalThis.fetch = savedFetch; console.warn = savedWarn;
        if (savedEnabled === undefined) delete process.env.BOOKING_RECONCILE_ENABLED; else process.env.BOOKING_RECONCILE_ENABLED = savedEnabled;
        if (savedSecret === undefined) delete process.env.BOOKING_RECONCILE_SECRET; else process.env.BOOKING_RECONCILE_SECRET = savedSecret;
      }
    });
    await t.test("switching to Production preserves Test history and never queries its links with the new environment", async () => {
      // Disposable database/providers only. No real commerce mode is changed.
      await sql.exec("TRUNCATE reservations CASCADE");
      const publicApi = await import("../src/app/api/reservations/[id]/route");
      const adminApi = await import("../src/app/api/admin/reservations/[id]/route");
      const worker = await import("../src/app/api/internal/reconcile/route");
      const { bookingEmails } = await import("../src/lib/booking-email-content");
      const { sendConfirmation } = await import("../src/lib/booking-email");
      const { cancelLocalReservation } = await import("../src/lib/admin-cancellation");
      const demo = await service.startReservation(payload("2033-01-01", "2033-01-02"), null, "https://fixture.netlify.app");
      links.get((await db.getBooking(demo.id))!.payment_link_id!)!.approved = true;
      await service.reconcilePayment(demo.id);
      const pending = await service.startReservation(payload("2033-01-03", "2033-01-04"), null, "https://fixture.netlify.app");
      const cancelled = await service.startReservation(payload("2033-01-05", "2033-01-06"), null, "https://fixture.netlify.app");
      closeLinkFailure = true;
      const savedLog = console.error; console.error = () => {};
      try { await cancelLocalReservation(cancelled.id, { dome: "domo-amplio", reason: "Cancelación previa al cambio", acknowledged: true, acknowledgeNoRefund: true }, "owner"); }
      finally { closeLinkFailure = false; console.error = savedLog; }
      const oldSettings = { environment: process.env.TILOPAY_EXPECTED_ENVIRONMENT,
        enabled: process.env.BOOKING_RECONCILE_ENABLED, secret: process.env.BOOKING_RECONCILE_SECRET };
      const savedNextLinkId = nextLinkId;
      const oldPaidLinkId = (await db.getBooking(demo.id))!.payment_link_id!;
      const oldPaidLink = links.get(oldPaidLinkId)!;
      const token = await auth.loginAdmin("owner", "A-private-test-password!", new Request("http://localhost"));
      cookieValues.set(auth.ADMIN_COOKIE, token);
      try {
        process.env.TILOPAY_EXPECTED_ENVIRONMENT = "Production";
        const oldPaid = (await db.getBooking(demo.id))!;
        assert.equal(oldPaid.payment_environment, "Test");
        assert(bookingEmails(oldPaid, "https://fixture.netlify.app").guest.text.includes("sin cargo real"));
        const publicResult = await publicApi.GET(new Request("http://localhost"), { params: Promise.resolve({ id: demo.id }) });
        assert.equal((await publicResult.json()).simulatedPayment, true);
        const beforeDetails = detailCalls, beforeLogins = loginCalls, beforeClose = closedLinks;
        await assert.rejects(service.reconcilePayment(pending.id), { reason: "environment_mismatch" });
        await assert.rejects(payments.closeInactivePaymentLink((await db.getBooking(cancelled.id))!), { reason: "environment_mismatch" });
        const request = new Request("http://localhost/api/admin/reservations/" + cancelled.id, { method: "POST",
          headers: { origin: "http://localhost", "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry-payment-link", dome: "domo-amplio" }) });
        assert.equal((await adminApi.POST(request, { params: Promise.resolve({ id: cancelled.id }) })).status, 409);
        process.env.BOOKING_RECONCILE_ENABLED = "true";
        process.env.BOOKING_RECONCILE_SECRET = "fixture-new-environment-worker-secret";
        await sql.query("UPDATE reservations SET confirmation_email_sent_at=NULL, owner_notification_sent_at=NULL WHERE id=$1", [demo.id]);
        const beforeMail = emailCalls;
        const run = await worker.POST(new Request("http://localhost/api/internal/reconcile", { method: "POST",
          headers: { "x-reconcile-secret": process.env.BOOKING_RECONCILE_SECRET } }));
        assert.deepEqual(await run.json(), { checked: 0, emailRetries: 0, failures: 0 });
        assert.equal(emailCalls, beforeMail); assert.equal(detailCalls, beforeDetails);
        assert.equal(loginCalls, beforeLogins); assert.equal(closedLinks, beforeClose);
        // An intentional resend retains the reservation's historical Test wording.
        await sendConfirmation((await db.getBooking(demo.id))!);
        assert(String(lastEmail!.text).includes("sin cargo real"));

        nextLinkId = Number(oldPaidLinkId); // Provider namespaces can reuse a numeric ID across environments.
        const real = await service.startReservation(payload("2033-02-01", "2033-02-02"), null, "https://fixture.netlify.app");
        const realPending = (await db.getBooking(real.id))!;
        assert.equal(realPending.payment_environment, "Production");
        assert.equal(realPending.payment_link_id, oldPaidLinkId);
        links.get(realPending.payment_link_id!)!.approved = true;
        const webhook = await import("../src/app/api/reservations/webhook/route");
        const notified = await webhook.POST(new Request("http://localhost/api/reservations/webhook", { method: "POST",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tilopayLinkId: realPending.payment_link_id, code: "1" }) }));
        assert.equal(notified.status, 200);
        assert.equal((await db.getBooking(real.id))!.status, "confirmed");
        assert.equal((await db.getBooking(demo.id))!.payment_environment, "Test");
        assert((transactionRequests.at(-1)!).environment === 0);
        const realBooking = (await db.getBooking(real.id))!;
        assert(bookingEmails(realBooking, "https://fixture.netlify.app").guest.text.includes("Total pagado"));
        assert(!bookingEmails(realBooking, "https://fixture.netlify.app").guest.text.includes("sin cargo real"));
        const realResult = await publicApi.GET(new Request("http://localhost"), { params: Promise.resolve({ id: real.id }) });
        assert.equal((await realResult.json()).simulatedPayment, false);
        // A later return to Test must not relabel or consult the real transaction either.
        process.env.TILOPAY_EXPECTED_ENVIRONMENT = "Test";
        const preserved = await publicApi.GET(new Request("http://localhost"), { params: Promise.resolve({ id: real.id }) });
        assert.equal((await preserved.json()).simulatedPayment, false);
        const oldView = await manual.adminCalendar("domo-amplio", "2033-01-01", "2033-02-01", false);
        assert(oldView.reservations.every(row => row.paymentEnvironment === "Test"));
        const liveView = await manual.adminCalendar("domo-amplio", "2033-02-01", "2033-03-01", false);
        assert.equal(liveView.reservations.find(row => row.id === real.id)!.paymentEnvironment, "Production");
      } finally {
        nextLinkId = savedNextLinkId; links.set(oldPaidLinkId, oldPaidLink);
        for (const [key, value] of [["TILOPAY_EXPECTED_ENVIRONMENT", oldSettings.environment], ["BOOKING_RECONCILE_ENABLED", oldSettings.enabled], ["BOOKING_RECONCILE_SECRET", oldSettings.secret]]) {
          if (value === undefined) delete process.env[key!]; else process.env[key!] = value;
        }
        await auth.logoutAdmin(); cookieValues.clear();
      }
    });
    await t.test("login rate limit is persisted in PostgreSQL", async () => {
      await sql.exec("TRUNCATE admin_login_limits");
      for (let index = 0; index < 10; index++) {
        await assert.rejects(auth.loginAdmin("owner", "wrong", new Request("http://localhost")), { status: 401 });
      }
      await assert.rejects(auth.loginAdmin("owner", "A-private-test-password!", new Request("http://localhost")), { status: 429 });
    });
  } finally {
    globalThis.fetch = originalFetch;
    pg.Pool = OriginalPool;
    nextHeaders.cookies = originalCookies;
    nodemailer.createTransport = originalTransport;
    await sql.close();
    if (oldMarker) require.cache[markerPath] = oldMarker;
    else delete require.cache[markerPath];
  }
});
