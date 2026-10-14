import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { BookingError } from "@/lib/booking-error";
import { getPool } from "@/lib/booking-db";
import { isPasswordHash, verifyAdminPassword } from "@/lib/admin-password.mjs";
import { getSiteOrigin } from "@/lib/site-origin";
import { logServerError } from "@/lib/safe-log";

export const ADMIN_COOKIE = "macasmoon_admin";
export const SESSION_SECONDS = 8 * 60 * 60;

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function adminConfigured() {
  return /^[A-Za-z0-9._-]{3,80}$/.test(process.env.ADMIN_USERNAME ?? "") && isPasswordHash(process.env.ADMIN_PASSWORD_HASH);
}

function fingerprint() {
  return digest(`${process.env.ADMIN_USERNAME}\0${process.env.ADMIN_PASSWORD_HASH}`);
}

export async function adminSession() {
  if (!adminConfigured()) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  try {
    const { rows } = await getPool().query(`SELECT token_hash FROM admin_sessions
      WHERE token_hash = $1 AND credentials_fingerprint = $2 AND expires_at > now()`, [digest(token), fingerprint()]);
    return rows.length === 1;
  } catch (error) { logServerError("Admin session unavailable", error); return false; }
}

export async function requireAdmin() {
  if (!await adminSession()) throw new BookingError("Inicia sesión para continuar.", 401);
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  // Next may canonicalize request.url to localhost behind a proxy. On Netlify,
  // use its configured public origin, never an arbitrary forwarded-host header.
  // Locally, Host is the actual browser-facing authority (e.g. 127.0.0.1:3000).
  const expected = process.env.SITE_ID && process.env.NODE_ENV !== "development"
    ? getSiteOrigin() : `${url.protocol}//${request.headers.get("host") ?? url.host}`;
  if (!expected || origin !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new BookingError("Solicitud no autorizada.", 403);
  }
}

export async function loginAdmin(username: unknown, password: unknown, request: Request) {
  if (!adminConfigured()) throw new BookingError("El acceso administrativo aún no está configurado.", 503);
  if (typeof username !== "string" || typeof password !== "string" || username.length > 100 || password.length > 256) {
    throw new BookingError("Usuario o contraseña incorrectos.", 401);
  }
  // Netlify supplies/overwrites this header. Do not trust arbitrary X-Forwarded-For.
  const ip = process.env.SITE_ID ? (request.headers.get("x-nf-client-connection-ip") ?? "unknown") : "local";
  const { rows } = await getPool().query<{ attempts: number }>(`INSERT INTO admin_login_limits
    (key_hash, attempts, window_started_at) VALUES ($1, 1, now())
    ON CONFLICT (key_hash) DO UPDATE SET
      attempts = CASE WHEN admin_login_limits.window_started_at < now() - interval '15 minutes'
        THEN 1 ELSE admin_login_limits.attempts + 1 END,
      window_started_at = CASE WHEN admin_login_limits.window_started_at < now() - interval '15 minutes'
        THEN now() ELSE admin_login_limits.window_started_at END RETURNING attempts`, [digest(ip)]);
  if (rows[0].attempts > 10) throw new BookingError("Demasiados intentos. Espera 15 minutos.", 429);
  const passwordOK = await verifyAdminPassword(password, process.env.ADMIN_PASSWORD_HASH!);
  const usernameOK = timingSafeEqual(Buffer.from(digest(username)), Buffer.from(digest(process.env.ADMIN_USERNAME!)));
  if (!passwordOK || !usernameOK) throw new BookingError("Usuario o contraseña incorrectos.", 401);
  const token = randomBytes(32).toString("hex");
  await getPool().query("DELETE FROM admin_sessions WHERE expires_at <= now()");
  await getPool().query("DELETE FROM admin_login_limits WHERE window_started_at < now() - interval '1 day'");
  await getPool().query(`INSERT INTO admin_sessions (token_hash, credentials_fingerprint, expires_at)
    VALUES ($1, $2, now() + interval '8 hours')`, [digest(token), fingerprint()]);
  return token;
}

export async function logoutAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (token) await getPool().query("DELETE FROM admin_sessions WHERE token_hash = $1", [digest(token)]);
}
