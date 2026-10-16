// ED-008: multi-seleksi — inspector hanya menampilkan satu nilai bila semua node sama; berbeda → "Mixed".

export const MIXED: unique symbol = Symbol("mixed");
export type Mixed = typeof MIXED;

// Nilai properti dokumen = JSON (DM-002) → kesetaraan struktural lewat serialisasi kanonik (urutan key diabaikan).
function canonical(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, inner]) => inner !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonical(inner)}`).join(",")}}`;
}

/** Satu nilai bila semua sama (struktural), `MIXED` bila berbeda, `undefined` bila tanpa nilai (seleksi kosong). */
export function mixedValue<T>(values: readonly T[]): T | Mixed | undefined {
  if (values.length === 0) return undefined;
  const [first, ...rest] = values as [T, ...T[]];
  const key = canonical(first);
  return rest.every((value) => canonical(value) === key) ? first : MIXED;
}

export const isMixed = (value: unknown): value is Mixed => value === MIXED;
