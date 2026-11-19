import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, relative } from "node:path";
import { parseBookingEnv } from "./booking-env.mjs";
import { configuredSecretEncodings, minimumSecretLength } from "./secret-encodings.mjs";
import { netlifySecretKeys } from "./netlify-env-policy.mjs";

// Read-only audit. Never prints secret values, matching text, provider URLs or tokens.
const findings = [];
const ignored = new Set([".git", "node_modules", ".next", ".netlify"]);
const privateKeys = new Set([...netlifySecretKeys, "NETLIFY_DB_URL", "RESEND_API_KEY"]);
const patterns = new Map();
function collect(key, value) {
  if (!privateKeys.has(key) || !value || value.length < minimumSecretLength) return;
  const variants = patterns.get(key) ?? new Set();
  for (const encoding of configuredSecretEncodings(value)) variants.add(encoding);
  if (key === "SMTP_PASSWORD") {
    for (const encoding of configuredSecretEncodings(value.replace(/\s/g, ""))) variants.add(encoding);
  }
  patterns.set(key, variants);
}
const run = promisify(execFile);
async function git(args) {
  try { return (await run("git", args, { encoding: "buffer", maxBuffer: 25_000_000 })).stdout; }
  catch { throw new Error("No se pudo leer Git para la auditoría; no se mostrarán su salida ni contenidos privados."); }
}
for (const file of [".env.local", ".env.netlify"]) {
  if (!existsSync(file)) continue;
  for (const [key, value] of parseBookingEnv(readFileSync(file, "utf8")).values) {
    collect(key, value);
  }
  if (process.platform !== "win32" && (statSync(file).mode & 0o077)) findings.push({ kind: "local-file-permissions", file });
}
for (const [key, value] of Object.entries(process.env)) {
  collect(key, value);
}
const encodedSecrets = [...patterns].map(([key, variants]) => [key, [...variants].map((value) => Buffer.from(value))]);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    if (item.isSymbolicLink()) return [];
    const file = join(dir, item.name);
    if (item.isDirectory()) return ignored.has(item.name) ? [] : walk(file);
    return [file];
  });
}

function scan(buffer, file, revision) {
  for (const [key, variants] of encodedSecrets) {
    if (variants.some((encoded) => buffer.includes(encoded))) {
      findings.push({ kind: "configured-private-value", key, file, ...(revision ? { revision } : {}) });
    }
  }
  const text = buffer.toString("utf8");
  for (const [kind, pattern] of [
    ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["aws-access-key", /\bAKIA[A-Z0-9]{16}\b/],
    ["github-token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
    ["resend-key", /\bre_[A-Za-z0-9]{24,}\b/],
  ]) if (pattern.test(text)) findings.push({ kind, file, ...(revision ? { revision } : {}) });
}

let files = 0;
let mediaMetadata = 0;
for (const file of walk(".")) {
  const path = relative(".", file);
  if (/^(?:\.env(?:\.|$)|.*\.tsbuildinfo$|next-env\.d\.ts$)/.test(path) && path !== ".env.example") continue;
  const buffer = readFileSync(file);
  files++;
  scan(buffer, path);
  if (path.startsWith("public/") && /(?:^|\/)(?:\.env.*|.*\.(?:sql|log|pem|key)|package-lock\.json)$/i.test(path)) findings.push({ kind: "private-file-in-public", file: path });
  if (path.startsWith("public/") && buffer.subarray(0, 4).toString() === "RIFF" &&
    (buffer.includes(Buffer.from("EXIF")) || buffer.includes(Buffer.from("XMP ")))) mediaMetadata++;
}

let artifacts = 0;
if (existsSync(".next")) {
  const folders = [".next/static", ".next/server/app"];
  for (const folder of folders) {
    if (!existsSync(folder)) continue;
    for (const file of walk(folder)) {
      if (folder.endsWith("app") && !/\.(html|rsc|meta|txt)$/.test(file)) continue;
      artifacts++;
      scan(readFileSync(file), file);
      if (/\.map$/.test(file) && folder.endsWith("static")) findings.push({ kind: "public-source-map", file });
    }
  }
}

let revisions = 0;
if (process.argv.includes("--history")) {
  const commits = (await git(["rev-list", "--all"])).toString().trim().split("\n").filter(Boolean);
  const seen = new Set();
  for (const revision of commits) {
    revisions++;
    const records = (await git(["ls-tree", "-rz", revision])).toString().split("\0").filter(Boolean);
    for (const record of records) {
      const match = /^\d+ blob ([a-f0-9]+)\t(.+)$/.exec(record);
      if (!match) continue;
      const [, hash, file] = match;
      if (/^(?:\.env(?:\.|$))/.test(file) && file !== ".env.example") findings.push({ kind: "private-env-in-history", file, revision: revision.slice(0, 8) });
      if (seen.has(hash)) continue;
      seen.add(hash);
      scan(await git(["cat-file", "blob", hash]), file, revision.slice(0, 8));
    }
  }
}
console.log(JSON.stringify({ files, publicArtifacts: artifacts, revisions, publicWebpWithExifOrXmp: mediaMetadata,
  findings, limits: "Scans configured values and selected patterns, not a guarantee or a penetration test. Public contact information and occupied dates remain intentionally public." }, null, 2));
if (findings.length) process.exitCode = 1;
