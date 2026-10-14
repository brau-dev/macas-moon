import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function isPasswordHash(value) {
  return typeof value === "string" && /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(value);
}

export async function hashAdminPassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 256) {
    throw new Error("Usa una contraseña de entre 12 y 256 caracteres.");
  }
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, options);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

export async function verifyAdminPassword(password, stored) {
  if (!isPasswordHash(stored) || typeof password !== "string" || password.length > 256) return false;
  const [, salt, digest] = stored.split(":");
  const key = await scrypt(password, salt, 64, options);
  return timingSafeEqual(key, Buffer.from(digest, "hex"));
}
