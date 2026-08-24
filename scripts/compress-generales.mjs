import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const MAX_BYTES = 300 * 1024;
const generalesDir = path.join(process.cwd(), "public", "assets", "Generales");
const nocturnoJpg = path.join(process.cwd(), "public", "assets", "otros", "macasmoon-nocturno.jpg");
const nocturnoWebp = path.join(process.cwd(), "public", "assets", "otros", "macasmoon-nocturno.webp");

async function compressWebp(filePath) {
  const original = await fs.readFile(filePath);
  if (original.byteLength <= MAX_BYTES) {
    return { file: path.basename(filePath), skipped: true, bytes: original.byteLength };
  }

  const meta = await sharp(original).metadata();
  const startWidth = Math.min(meta.width ?? 1600, 1600);
  let output = await sharp(original)
    .resize({ width: startWidth, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();

  if (output.byteLength > MAX_BYTES) {
    output = await sharp(original)
      .resize({ width: Math.min(startWidth, 1400), withoutEnlargement: true })
      .webp({ quality: 62 })
      .toBuffer();
  }

  if (output.byteLength > MAX_BYTES) {
    output = await sharp(original)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 58 })
      .toBuffer();
  }

  await fs.writeFile(filePath, output);
  return {
    file: path.basename(filePath),
    skipped: false,
    from: original.byteLength,
    to: output.byteLength,
  };
}

const files = (await fs.readdir(generalesDir)).filter((name) => name.toLowerCase().endsWith(".webp"));

for (const file of files) {
  const result = await compressWebp(path.join(generalesDir, file));
  if (result.skipped) {
    console.log(`skip  ${result.file} (${Math.round(result.bytes / 1024)} KB)`);
  } else {
    console.log(`done  ${result.file} ${Math.round(result.from / 1024)} KB -> ${Math.round(result.to / 1024)} KB`);
  }
}

try {
  await fs.access(nocturnoJpg);
  const converted = await sharp(nocturnoJpg).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  await fs.writeFile(nocturnoWebp, converted);
  await fs.unlink(nocturnoJpg);
  console.log(`done  macasmoon-nocturno.webp ${Math.round(converted.byteLength / 1024)} KB`);
} catch {
  console.log("skip  macasmoon-nocturno.jpg (already converted or missing)");
}
