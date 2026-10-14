import type { ColorValue, LengthValue, TokenRef } from "@platform/document-model";

// DM-041 / PUB-043 (keputusan owner 2026-10-15): token → CSS custom property ber-prefix `--t-`
// (`color.primary` → `--t-color-primary`, `color.brand.600` → `--t-color-brand-600`). Node merujuk `var(--t-…)`
// sehingga ganti tema hanya mengubah `:root`. `type.*` = alias pendek grup `typography`.
export function tokenVarName(path: string): string {
  const [head, ...rest] = path.split(".");
  // Pertahanan berlapis: dokumen yang belum tervalidasi tidak boleh menyisipkan `)`/`;` ke CSS lewat path token.
  return `--t-${[head === "type" ? "typography" : head, ...rest].join("-").replace(/[^a-zA-Z0-9-]/g, "_")}`;
}

/** Variabel satu field token typography komposit: `typography.h1` + `font-size` → `--t-typography-h1-font-size`. */
export function typographyVarName(path: string, cssProperty: string): string {
  return `${tokenVarName(path)}-${cssProperty}`;
}

export function tokenVar(ref: TokenRef): string {
  return `var(${tokenVarName(ref.$token)})`;
}

const UNITS = new Set(["px", "%", "vw", "vh", "rem", "em", "fr"]);
const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

// Nilai yang tidak berbentuk sesuai skema (dokumen belum tervalidasi) → nilai netral, bukan teks mentah ke CSS.
export function lengthToCss(value: LengthValue): string {
  if ("$token" in value) return tokenVar(value);
  return Number.isFinite(value.value) && UNITS.has(value.unit) ? `${value.value}${value.unit}` : "0";
}

export function colorToCss(value: ColorValue): string {
  if (typeof value === "string") return HEX.test(value) ? value : "currentColor";
  if ("alpha" in value) {
    const alpha = Number.isFinite(value.alpha) ? Math.min(1, Math.max(0, value.alpha)) : 1;
    return `color-mix(in srgb, ${tokenVar(value)} ${alpha * 100}%, transparent)`;
  }
  return tokenVar(value);
}

/**
 * String CSS berkutip ganda yang aman (nama font, URL): escape `\`, `"`, baris baru, dan `<` (CSS di-inline dalam
 * `<style>` — `</style>` di nama font tidak boleh menutup elemen).
 */
export function cssString(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\n\r\f]/g, "\\a ")
    .replace(/</g, "\\3c ");
  return `"${escaped}"`;
}
