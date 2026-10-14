import { mergeStyle } from "../commands/merge-style";
import { type ResponsiveStyle, type Style, type StylePatch, StyleSchema, type Theme } from "../schema";
import { isTokenRef } from "../schema/values";
import { resolveToken, TokenResolveError } from "./tokens";

export const BREAKPOINTS = ["base", "tablet", "mobile"] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/** Theme untuk ekspansi token typography komposit; breakpoint memilih varian token responsif. */
export type StyleContext = { theme?: Theme; breakpoint?: Breakpoint };

// DM-032/DM-036: "pakai type.h1 tapi ukuran beda" — token komposit di-expand dulu menjadi literal, baru field patch
// di-merge. Tanpa theme (atau token tak ter-resolve) patch objek mengganti utuh (perilaku `mergeStyle`).
function expandTypographyToken(style: Style, patch: StylePatch, ctx: StyleContext): Style {
  const typography = style.typography;
  const patchTypography = patch.typography;
  if (!ctx.theme || !isTokenRef(typography) || !patchTypography || isTokenRef(patchTypography)) return { ...style };
  try {
    const literal = resolveToken(ctx.theme, typography.$token, {
      ...(ctx.breakpoint ? { breakpoint: ctx.breakpoint } : {}),
    });
    const parsed = StyleSchema.shape.typography.safeParse(literal);
    return parsed.success ? { ...style, typography: parsed.data } : { ...style };
  } catch (error) {
    if (error instanceof TokenResolveError) return { ...style };
    throw error;
  }
}

/**
 * Terapkan patch ke style dengan aturan merge DM-036 (sama dengan `updateStyle`). Patch yang menghasilkan
 * style tidak valid (mis. ganti mode layout tanpa field wajib mode baru) diabaikan: `style` dikembalikan apa adanya.
 */
export function applyStylePatch(style: Style, patch: StylePatch, ctx: StyleContext = {}): Style {
  const parsed = StyleSchema.safeParse(mergeStyle(expandTypographyToken(style, patch, ctx), patch));
  return parsed.success ? parsed.data : style;
}

/**
 * Style efektif di satu breakpoint (DM-036), desktop-first:
 * `effective(bp) = merge(base, tablet jika bp ∈ {tablet, mobile}, mobile jika bp = mobile)`.
 */
export function resolveStyle(style: ResponsiveStyle, breakpoint: Breakpoint, ctx: { theme?: Theme } = {}): Style {
  if (breakpoint === "base") return style.base;
  const at = (bp: Breakpoint): StyleContext => ({ ...ctx, breakpoint: bp });
  const tablet = style.tablet ? applyStylePatch(style.base, style.tablet, at(breakpoint)) : style.base;
  if (breakpoint === "tablet" || !style.mobile) return tablet;
  return applyStylePatch(tablet, style.mobile, at("mobile"));
}

/**
 * Resolver ter-memoize per (nodeId, breakpoint, docRevision) — AC DM-036. Hanya revisi terakhir per node+breakpoint
 * yang disimpan, jadi memori sebanding jumlah node. `docRevision` = penanda perubahan dokumen milik pemanggil
 * (termasuk perubahan theme — buat resolver baru bila objek theme diganti).
 */
export function createStyleResolver(
  ctx: { theme?: Theme } = {},
): (nodeId: string, style: ResponsiveStyle, breakpoint: Breakpoint, docRevision: number) => Style {
  const cache = new Map<string, { revision: number; style: Style }>();
  return (nodeId, style, breakpoint, docRevision) => {
    const key = `${nodeId}\u0000${breakpoint}`;
    const hit = cache.get(key);
    if (hit && hit.revision === docRevision) return hit.style;
    const resolved = resolveStyle(style, breakpoint, ctx);
    cache.set(key, { revision: docRevision, style: resolved });
    return resolved;
  };
}
