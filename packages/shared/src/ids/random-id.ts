// String acak huruf kecil + angka (Web Crypto, isomorfik) untuk slug/kode yang tampil di URL.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const webCrypto = (globalThis as unknown as { crypto: { getRandomValues(bytes: Uint8Array): Uint8Array } }).crypto;

export function randomAlphanumeric(length: number): string {
  let result = "";
  while (result.length < length) {
    for (const byte of webCrypto.getRandomValues(new Uint8Array(length * 2))) {
      // Tolak byte ≥ 252 (= 7 × 36) agar setiap karakter berpeluang sama (tanpa bias modulo).
      if (byte < 252 && result.length < length) result += ALPHABET[byte % 36];
    }
  }
  return result;
}

/** Slug personal workspace untuk URL dashboard `/w/{slug}` (ACC-030): `ws_` + 10 karakter acak. */
export const personalWorkspaceSlug = (): string => `ws_${randomAlphanumeric(10)}`;
