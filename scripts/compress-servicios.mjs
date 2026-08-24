import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_BYTES = 300 * 1024;
const serviciosDir = path.join(process.cwd(), "public", "assets", "servicios");

const conversions = [
  { from: "IMG_9020.jpeg", to: "decoracion-cumpleanos.webp" },
  { from: "IMG_1423.jpeg", to: "decoracion-propuesta.webp" },
  { from: "9951566a-f119-4df1-89b4-e92946203001.jpeg", to: "decoracion-cumpleanos-oro.webp" },
  { from: "IMG_0876.jpeg", to: "decoracion-cumpleanos-rojo.webp" },
  { from: "c8fb5211-3e8b-4e73-92e5-687cd29e8cbe.jpeg", to: "decoracion-romantica.webp" },
  { from: "IMG_1790.jpeg", to: "masaje-relajante.webp" },
];

const unused = [
  "IMG_1788.jpeg",
  "IMG_1789.jpeg",
  "IMG_1791.jpeg",
  "IMG_1634.jpeg",
  "IMG_9263.jpeg",
];

async function toWebp(fromPath, toPath) {
  const original = await fs.readFile(fromPath);
  const meta = await sharp(original).metadata();
  const startWidth = Math.min(meta.width ?? 1600, 1600);
  let quality = 72;
  let width = startWidth;
  let output = await sharp(original)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  if (output.byteLength > MAX_BYTES) {
    width = Math.min(width, 1400);
    quality = 62;
    output = await sharp(original)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  }

  if (output.byteLength > MAX_BYTES) {
    width = 1200;
    quality = 58;
    output = await sharp(original)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
  }

  await fs.writeFile(toPath, output);
  return {
    fromBytes: original.byteLength,
    toBytes: output.byteLength,
    width: (await sharp(output).metadata()).width,
  };
}

for (const item of conversions) {
  const fromPath = path.join(serviciosDir, item.from);
  const toPath = path.join(serviciosDir, item.to);
  const result = await toWebp(fromPath, toPath);
  await fs.unlink(fromPath);
  console.log(
    `done  ${item.from} -> ${item.to} ${Math.round(result.fromBytes / 1024)} KB -> ${Math.round(result.toBytes / 1024)} KB (w${result.width})`,
  );
}

for (const file of unused) {
  try {
    await fs.unlink(path.join(serviciosDir, file));
    console.log(`removed unused ${file}`);
  } catch {
    console.log(`skip  ${file}`);
  }
}
