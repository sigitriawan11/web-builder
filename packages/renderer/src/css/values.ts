import type { ColorValue, LengthValue, TokenRef } from "@platform/document-model";

// DM-041: node merujuk token lewat CSS variable (`color.primary` → `var(--color-primary)`) sehingga ganti tema tidak
// perlu render ulang node. `type.*` = alias pendek grup `typography`.
export function tokenVarName(path: string): string {
  const [head, ...rest] = path.split(".");
  return `--${[head === "type" ? "typography" : head, ...rest].join("-")}`;
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
