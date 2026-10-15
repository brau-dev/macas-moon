import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Module } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { hashAdminPassword, verifyAdminPassword } from "../src/lib/admin-password.mjs";

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

  let queue = Promise.resolve();
  let failBookingRead = false;
  async function acquire() {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    return release;
  }
  const query = async (text: string, args?: unknown[]) => {
    const result = await sql.query(text, args);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  class TestPool {
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
  type Link = { reference: string; amount: string; currency: string; order: string; approved: boolean };
  const links = new Map<string, Link>();
  let paymentBody: Record<string, unknown> | null = null;
  let createdPayments = 0;
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
        currency: String(paymentBody!.currency), order: `TPT${id}`, approved: false });
      return Response.json({ type: "200", url: linkFixture === "unsafe_url"
        ? `https://tilo.co.attacker.example/link/${id}` : `https://tilo.co/link/${id}`,
        ...(linkFixture === "missing_id" ? {} : { id: Number(id) }) });
    }
    if (url.includes("/getDetailLinkPayment/")) {
      const id = url.split("/").at(-2)!;
      const link = links.get(id)!;
      return Response.json({ type: "200", detail: { id: Number(id), reference: detailFixture === "wrong_reference" ? "OTHER_REFERENCE" : link.reference,
        amount: link.amount, currency: link.currency }, payments: link.approved ? [detailFixture === "legacy"
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
        code: "1", capture: "Capture", environment: "Test", type: "Payment",
      }));
      if (transactionFixture === "invalid_response") return Response.json({ type: "200", response: {} });
      const result = rows.map((row) => ({ ...row,
        ...(transactionFixture === "unrelated" ? { id: row.id + 900_000 } : {}),
        ...(transactionFixture === "wrong_amount" ? { amount: "9999.99" } : {}),
        ...(transactionFixture === "wrong_currency" ? { currency: "CRC" } : {}),
        ...(transactionFixture === "wrong_environment" ? { environment: "Production" } : {}),
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
        amount: link.amount, currency: link.currency, code: "1", capture: "Capture", environment: "Test", type: "Payment" }] : [] });
    }
    if (url.endsWith("/deleteLinkPayment")) return Response.json({ type: "200" });
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
      const content = bookingEmails({ ...booking, guest_name: '<script>alert("x")</script> & Guest' }, "Production", "https://fixture.netlify.app");
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
      const render = (environment: string) => renderToStaticMarkup(createElement(AppRouterContext.Provider,
        { value: router }, createElement(AdminDashboard, { domes: getAdminDomeOptions(),
          checkout: { enabled: true, freeTest: false, environment, missing: [], emailMissing: [] }, siteOrigin: "https://fixture.netlify.app" })));
      const html = render("Production");
      assert(html.includes('value="domo-romantico"')); assert(html.includes('value="domo-amplio"'));
      assert(html.includes("Ver calendario de")); assert(html.includes("Romántico")); assert(html.includes("Amplio"));
      assert(!/\b(?:pruebas?|simulad[oa]s?|test)\b/i.test(html));
      assert(html.includes("https://fixture.netlify.app/api/calendar/domo-amplio/calendar.ics"));
      assert(render("Test").includes("Operaciones sin cargos reales"));
    });
    await t.test("commercial emails have no trial labels; simulated payments are never described as money charged", async () => {
      const { bookingEmails } = await import("../src/lib/booking-email-content");
      const booking = { ...(await db.getBooking(paidBookingId))!, guest_name: "María Castro" };
      const production = bookingEmails(booking, "Production", "https://fixture.netlify.app");
      const simulated = bookingEmails(booking, "Test", "https://fixture.netlify.app");
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
