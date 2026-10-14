import {
  canonicalTokenPath,
  listTokenPaths,
  type SiteDocument,
  type Theme,
  type TypographyStyle,
  tokenEntry,
  tokenGroupOf,
} from "@platform/document-model";
import { type Declaration, fontStack, typographyValue } from "./declarations";
import { lengthToCss, tokenVar, tokenVarName, typographyVarName } from "./values";

// PUB-043: token → CSS custom property di `:root` (hanya yang terpakai). Alias tetap `var(--t-…)` agar mengganti nilai
// token sumber cukup mengubah satu variabel. Varian responsif (`tablet`/`mobile`) dikembalikan terpisah untuk media
// query (T1.10.3).

type Breakpoint = "base" | "tablet" | "mobile";
export type TokenDeclarations = Record<Breakpoint, Declaration[]>;

const TYPOGRAPHY_FIELDS: readonly (readonly [keyof TypographyStyle, string])[] = [
  ["fontFamily", "font-family"],
  ["fontSize", "font-size"],
  ["fontWeight", "font-weight"],
  ["lineHeight", "line-height"],
  ["letterSpacing", "letter-spacing"],
  ["textTransform", "text-transform"],
  ["textDecoration", "text-decoration"],
  ["textAlign", "text-align"],
  ["fontStyle", "font-style"],
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isRef = (value: unknown): value is { $token: string } => isRecord(value) && typeof value.$token === "string";

function shadowCss(value: unknown): string {
  if (!Array.isArray(value)) return "none";
  return value
    .filter((shadow) => isRecord(shadow) && shadow.visible !== false)
    .map((shadow) => {
      const s = shadow as { type: string; x: number; y: number; blur: number; spread?: number; color: string };
      const color = isRef(s.color) ? tokenVar(s.color) : s.color;
      return `${s.type === "innerShadow" ? "inset " : ""}${s.x}px ${s.y}px ${s.blur}px ${s.spread ?? 0}px ${color}`;
    })
    .join(", ");
}

// Literal satu token → deklarasi (typography komposit = satu variabel per field).
function literalDeclarations(path: string, literal: unknown, theme: Theme): Declaration[] {
  const name = tokenVarName(path);
  if (isRef(literal)) {
    if (tokenGroupOf(path) !== "typography") return [[name, tokenVar(literal)]];
    // Alias typography → arahkan setiap field ke field token sumber.
    return TYPOGRAPHY_FIELDS.map(([, property]) => [
      typographyVarName(path, property),
      `var(${typographyVarName(literal.$token, property)})`,
    ]);
  }
  switch (tokenGroupOf(path)) {
    case "color":
      return [[name, String(literal)]];
    case "fontFamily":
      return [[name, fontStack(String(literal), theme)]];
    case "shadow":
      return [[name, shadowCss(literal)]];
    case "typography": {
      if (!isRecord(literal)) return [];
      const out: Declaration[] = [];
      for (const [field, property] of TYPOGRAPHY_FIELDS) {
        const value = typographyValue(field, literal[field], theme);
        if (value !== undefined) out.push([typographyVarName(path, property), value]);
      }
      return out;
    }
    default:
      return isRecord(literal) && "unit" in literal ? [[name, lengthToCss(literal as never)]] : [];
  }
}

/** Rujukan token yang dipakai dokumen (node + alias theme, transitif) — untuk tree-shake `:root`. */
export function usedTokens(doc: Pick<SiteDocument, "nodes" | "theme">): Set<string> {
  const used = new Set<string>();
  const queue: string[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (isRef(value)) {
      const path = canonicalTokenPath(value.$token);
      if (!used.has(path)) {
        used.add(path);
        queue.push(path);
      }
    } else if (isRecord(value)) Object.values(value).forEach(visit);
  };
  for (const node of Object.values(doc.nodes)) {
    visit(node.style);
    visit(node.props);
  }
  // Alias & field token komposit bisa merujuk token lain.
  while (queue.length > 0) visit(tokenEntry(doc.theme, queue.pop() as string));
  return used;
}

/** Deklarasi variabel token per breakpoint; `used` membatasi ke token yang terpakai (tanpa = semua). */
export function tokenDeclarations(theme: Theme, used?: ReadonlySet<string>): TokenDeclarations {
  const result: TokenDeclarations = { base: [], tablet: [], mobile: [] };
  for (const path of listTokenPaths(theme)) {
    if (used && !used.has(path)) continue;
    const entry = tokenEntry(theme, path);
    const responsive = isRecord(entry) && "value" in entry && !("unit" in entry) ? entry : undefined;
    result.base.push(...literalDeclarations(path, responsive ? responsive.value : entry, theme));
    if (responsive?.tablet !== undefined) result.tablet.push(...literalDeclarations(path, responsive.tablet, theme));
    if (responsive?.mobile !== undefined) result.mobile.push(...literalDeclarations(path, responsive.mobile, theme));
  }
  return result;
}
