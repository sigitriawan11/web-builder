import { createHash } from "node:crypto";
import { encode as encodeBlurhash } from "blurhash";
import sharp from "sharp";

// ARCHITECTURE §9.9: proses gambar raster — auto-orient + strip EXIF (default sharp), varian WebP/AVIF, blurhash,
// dimensi, sha256 (dedupe). Murni (Buffer→Buffer) agar bisa diuji tanpa storage.

export interface ProcessedImage {
  width: number;
  height: number;
  blurhash: string;
  sha256: string;
  webp: Buffer;
  avif: Buffer;
}

// Komponen blurhash (makin besar makin detail; 4×3 standar untuk placeholder).
const BLURHASH_X = 4;
const BLURHASH_Y = 3;
// Blurhash dihitung dari versi kecil (cepat & cukup untuk placeholder buram).
const BLURHASH_MAX = 32;

export async function processRasterImage(input: Buffer): Promise<ProcessedImage> {
  // `rotate()` tanpa argumen = auto-orient dari EXIF, lalu metadata dibuang (sharp tidak menyertakan metadata kecuali
  // `withMetadata()`), jadi EXIF (termasuk GPS) ter-strip.
  const base = sharp(input, { failOn: "error" }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("gambar tanpa dimensi (format tidak valid)");

  const [webp, avif, raw] = await Promise.all([
    base.clone().webp({ quality: 80 }).toBuffer(),
    base.clone().avif({ quality: 50 }).toBuffer(),
    base
      .clone()
      .resize(BLURHASH_MAX, BLURHASH_MAX, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  const blurhash = encodeBlurhash(
    new Uint8ClampedArray(raw.data),
    raw.info.width,
    raw.info.height,
    BLURHASH_X,
    BLURHASH_Y,
  );
  const sha256 = createHash("sha256").update(input).digest("hex");
  return { width: meta.width, height: meta.height, blurhash, sha256, webp, avif };
}
