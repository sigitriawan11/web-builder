// WCAG 2.x kontras rasio dari dua warna hex (R-A11Y / CMP-124). Dipakai uji kontras preset theme (T3.11.1/T3.11.14).
// Alpha (hex 8-digit) diabaikan (ambil 6 digit pertama) — token teks/latar preset tidak memakai alpha.

function channelLinear(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminansi relatif (0 hitam … 1 putih). `hex` = `#RRGGBB` (atau `#RRGGBBAA`, alpha diabaikan). */
export function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "").slice(0, 6);
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return 0.2126 * channelLinear(r) + 0.7152 * channelLinear(g) + 0.0722 * channelLinear(b);
}

/** Rasio kontras WCAG (1…21). AA: ≥ 4.5 teks normal, ≥ 3 teks besar. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const [lighter, darker] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

export const WCAG_AA_NORMAL = 4.5;
export const WCAG_AA_LARGE = 3;
