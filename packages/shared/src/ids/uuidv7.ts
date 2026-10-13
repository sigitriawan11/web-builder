import { z } from "zod";

// UUIDv7 (RFC 9562 §5.7) untuk primary key tabel (ARCHITECTURE §6.1): 48 bit Unix ms + versi + 74 bit sisa.
// Terurut waktu → insert ramah index B-tree. Dalam satu milidetik yang sama, 12 bit `rand_a` dipakai sebagai
// counter (RFC 9562 §6.2 metode 1) agar ID dari proses yang sama tetap naik monoton.
// Isomorfik: Web Crypto `getRandomValues` ada di Node 22, browser, dan Cloudflare Workers.

type RandomSource = (bytes: Uint8Array) => Uint8Array;

const webCrypto = (globalThis as unknown as { crypto: { getRandomValues(bytes: Uint8Array): Uint8Array } }).crypto;
const defaultRandom: RandomSource = (bytes) => webCrypto.getRandomValues(bytes);

const MAX_COUNTER = 0xfff;
const HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, "0"));

export const UUIDV7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const UuidV7Schema = z.string().regex(UUIDV7_PATTERN, "bukan UUIDv7");

export type UuidV7Generator = () => string;

/**
 * Generator dengan state monoton sendiri; `now` & `random` bisa diganti untuk test.
 * Jam mundur (mis. sinkronisasi NTP) tidak membuat ID turun: timestamp terakhir dipakai sampai jam menyusul.
 */
export function createUuidV7Generator(
  now: () => number = Date.now,
  random: RandomSource = defaultRandom,
): UuidV7Generator {
  let lastMs = -1;
  let counter = 0;
  return () => {
    let ms = Math.max(now(), lastMs);
    const bytes = random(new Uint8Array(16));
    if (ms === lastMs) {
      counter += 1;
      // Counter habis (> 4096 ID/ms): pinjam milidetik berikutnya agar urutan tetap terjaga.
      if (counter > MAX_COUNTER) {
        ms += 1;
        counter = (bytes[6] ?? 0) & 0x07;
      }
    } else {
      // Mulai dari nilai acak kecil: masih acak, tapi menyisakan ruang ±3.500 increment dalam milidetik itu.
      counter = (((bytes[6] ?? 0) & 0x07) << 8) | (bytes[7] ?? 0);
    }
    lastMs = ms;

    // 48 bit timestamp, big-endian.
    let rest = ms;
    for (let index = 5; index >= 0; index--) {
      bytes[index] = rest % 256;
      rest = Math.floor(rest / 256);
    }
    bytes[6] = 0x70 | (counter >> 8); // versi 7 + 4 bit atas counter
    bytes[7] = counter & 0xff;
    bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f); // varian RFC 9562 (10xx)

    let hex = "";
    for (const byte of bytes) hex += HEX[byte];
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

/** UUIDv7 baru (generator bersama per proses/tab). */
export const uuidv7: UuidV7Generator = createUuidV7Generator();

/** Waktu pembuatan (Unix ms) yang tertanam di UUIDv7; `null` bila bukan UUIDv7. */
export function uuidV7Timestamp(id: string): number | null {
  if (!UUIDV7_PATTERN.test(id)) return null;
  return Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
}
