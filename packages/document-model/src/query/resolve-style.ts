import { mergeStyle } from "../ops/merge-style";
import { type ResponsiveStyle, type Style, type StylePatch, StyleSchema } from "../schema";

export const BREAKPOINTS = ["base", "tablet", "mobile"] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/**
 * Terapkan patch ke style dengan aturan merge DM-036 (sama dengan `updateStyle`). Patch yang menghasilkan
 * style tidak valid (mis. ganti mode layout tanpa field wajib mode baru) diabaikan: `style` dikembalikan apa adanya.
 */
export function applyStylePatch(style: Style, patch: StylePatch): Style {
  const parsed = StyleSchema.safeParse(mergeStyle({ ...style }, patch));
  return parsed.success ? parsed.data : style;
}

/**
 * Style efektif di satu breakpoint (DM-036), desktop-first:
 * `effective(bp) = merge(base, tablet jika bp ∈ {tablet, mobile}, mobile jika bp = mobile)`.
 */
export function resolveStyle(style: ResponsiveStyle, breakpoint: Breakpoint): Style {
  if (breakpoint === "base") return style.base;
  const tablet = style.tablet ? applyStylePatch(style.base, style.tablet) : style.base;
  if (breakpoint === "tablet" || !style.mobile) return tablet;
  return applyStylePatch(tablet, style.mobile);
}

/**
 * Resolver ter-memoize per (nodeId, breakpoint, docRevision) — AC DM-036. Hanya revisi terakhir per node+breakpoint
 * yang disimpan, jadi memori sebanding jumlah node. `docRevision` = penanda perubahan dokumen milik pemanggil.
 */
export function createStyleResolver(): (
  nodeId: string,
  style: ResponsiveStyle,
  breakpoint: Breakpoint,
  docRevision: number,
) => Style {
  const cache = new Map<string, { revision: number; style: Style }>();
  return (nodeId, style, breakpoint, docRevision) => {
    const key = `${nodeId}\u0000${breakpoint}`;
    const hit = cache.get(key);
    if (hit && hit.revision === docRevision) return hit.style;
    const resolved = resolveStyle(style, breakpoint);
    cache.set(key, { revision: docRevision, style: resolved });
    return resolved;
  };
}
