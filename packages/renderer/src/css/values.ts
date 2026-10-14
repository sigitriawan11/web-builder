import type { ColorValue, LengthValue, TokenRef } from "@platform/document-model";

// DM-041 / PUB-043 (keputusan owner 2026-10-15): token → CSS custom property ber-prefix `--t-`
// (`color.primary` → `--t-color-primary`, `color.brand.600` → `--t-color-brand-600`). Node merujuk `var(--t-…)`
// sehingga ganti tema hanya mengubah `:root`. `type.*` = alias pendek grup `typography`.
export function tokenVarName(path: string): string {
  const [head, ...rest] = path.split(".");
  return `--t-${[head === "type" ? "typography" : head, ...rest].join("-")}`;
}

/** Variabel satu field token typography komposit: `typography.h1` + `font-size` → `--t-typography-h1-font-size`. */
export function typographyVarName(path: string, cssProperty: string): string {
  return `${tokenVarName(path)}-${cssProperty}`;
}

export function tokenVar(ref: TokenRef): string {
  return `var(${tokenVarName(ref.$token)})`;
}

export function lengthToCss(value: LengthValue): string {
  return "$token" in value ? tokenVar(value) : `${value.value}${value.unit}`;
}

export function colorToCss(value: ColorValue): string {
  if (typeof value === "string") return value;
  if ("alpha" in value) return `color-mix(in srgb, ${tokenVar(value)} ${value.alpha * 100}%, transparent)`;
  return tokenVar(value);
}

/** String CSS berkutip ganda yang aman (nama font, URL): escape `\`, `"`, dan baris baru. */
export function cssString(value: string): string {
  return `"${value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\n\r\f]/g, "\\a ")}"`;
}
