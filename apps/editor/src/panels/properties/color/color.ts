// ED-102: util warna untuk color picker. Format dokumen = hex `#rrggbb` atau `#rrggbbaa` (DM-029).

const HEX3 = /^[0-9a-f]{3}$/;
const HEX4 = /^[0-9a-f]{4}$/;
const HEX6 = /^[0-9a-f]{6}$/;
const HEX8 = /^[0-9a-f]{8}$/;

/** Normalkan input hex (shorthand → panjang, lowercase, prefix `#`); null bila tidak valid. */
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, "").toLowerCase();
  if (HEX3.test(s)) return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  if (HEX4.test(s)) return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  if (HEX6.test(s) || HEX8.test(s)) return `#${s}`;
  return null;
}

export function isValidHex(input: string): boolean {
  return normalizeHex(input) !== null;
}

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Hex → RGB (0–255); null bila tidak valid. Komponen alpha diabaikan. */
export function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const s = normalized.slice(1);
  return {
    r: Number.parseInt(s.slice(0, 2), 16),
    g: Number.parseInt(s.slice(2, 4), 16),
    b: Number.parseInt(s.slice(4, 6), 16),
  };
}

const channel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");

/** RGB (0–255) → hex `#rrggbb` (di-clamp). */
export function rgbToHex({ r, g, b }: Rgb): string {
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** Alpha 0–1 dari hex `#rrggbbaa` (default 1 bila 6-digit). */
export function hexAlpha(hex: string): number {
  const normalized = normalizeHex(hex);
  if (normalized?.length !== 9) return 1;
  return Number.parseInt(normalized.slice(7, 9), 16) / 255;
}
