import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Mechanical WebP metadata cleanup: compressed image/color/animation chunks are
// copied byte-for-byte, never decoded or recompressed. Default mode is read-only.
const write = process.argv.includes("--write");
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) return [];
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : /\.webp$/i.test(path) ? [path] : [];
  });
}
let count = 0;
for (const path of walk("public")) {
  const source = readFileSync(path);
  if (source.toString("ascii", 0, 4) !== "RIFF" || source.toString("ascii", 8, 12) !== "WEBP" ||
    source.readUInt32LE(4) + 8 !== source.length) throw new Error(`Invalid WebP container: ${path}`);
  const chunks = [];
  let metadata = false;
  for (let offset = 12; offset < source.length;) {
    if (offset + 8 > source.length) throw new Error(`Truncated WebP: ${path}`);
    const size = source.readUInt32LE(offset + 4);
    const end = offset + 8 + size + (size % 2);
    if (end > source.length) throw new Error(`Truncated WebP chunk: ${path}`);
    const name = source.toString("ascii", offset, offset + 4);
    if (name === "EXIF" || name === "XMP ") metadata = true;
    else chunks.push(Buffer.from(source.subarray(offset, end)));
    offset = end;
  }
  if (!metadata) continue;
  count++;
  if (!write) continue;
  for (const chunk of chunks) {
    if (chunk.toString("ascii", 0, 4) === "VP8X") chunk[8] &= ~0x0c;
  }
  const header = Buffer.from(source.subarray(0, 12));
  const length = chunks.reduce((total, chunk) => total + chunk.length, 12);
  header.writeUInt32LE(length - 8, 4);
  writeFileSync(path, Buffer.concat([header, ...chunks]));
}
console.log(JSON.stringify({ mode: write ? "metadata removed, image chunks unchanged" : "read-only", webpWithMetadata: count }));
