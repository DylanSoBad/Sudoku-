/**
 * Rasterize public/icons/icon.svg into every favicon / PWA size.
 *
 * Usage (from repo root):
 *   node scripts/gen-icons.mjs
 *
 * Writes favicon-16/32, apple-touch-icon, icon-192/512 and a PNG-embedded
 * favicon.ico. Bump the `?v=` query in app/layout.tsx + manifest afterwards:
 * browsers cache favicons far longer than any other asset.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DETAILED = join(ROOT, "public", "icons", "icon.svg");
/** Below ~48px the 9x9 lines collapse into noise, so small sizes use the block-grid mark. */
const COMPACT = join(ROOT, "public", "icons", "icon-small.svg");

const TARGETS = [
  { size: 16, src: COMPACT, out: ["public", "favicon-16x16.png"] },
  { size: 32, src: COMPACT, out: ["public", "favicon-32x32.png"] },
  { size: 180, src: DETAILED, out: ["public", "apple-touch-icon.png"] },
  { size: 192, src: DETAILED, out: ["public", "icons", "icon-192.png"] },
  { size: 512, src: DETAILED, out: ["public", "icons", "icon-512.png"] },
];

const ICO_SIZES = [16, 32, 48];

async function render(svg, size) {
  return sharp(svg, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
}

/** Minimal PNG-embedded ICO container (ICONDIR + entries + payloads). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  const detailed = readFileSync(DETAILED);
  const compact = readFileSync(COMPACT);

  for (const { size, src, out } of TARGETS) {
    const buf = await render(src === COMPACT ? compact : detailed, size);
    const path = join(ROOT, ...out);
    writeFileSync(path, buf);
    console.log(`  ${String(size).padStart(3)}px -> ${out.join("/")} (${buf.length} bytes)`);
  }

  const icoImages = [];
  for (const size of ICO_SIZES) {
    icoImages.push({ size, data: await render(compact, size) });
  }
  const ico = buildIco(icoImages);
  writeFileSync(join(ROOT, "public", "favicon.ico"), ico);
  console.log(`  ico ${ICO_SIZES.join("/")} -> public/favicon.ico (${ico.length} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
