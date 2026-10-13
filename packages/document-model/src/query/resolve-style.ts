import { mergeStyle } from "../ops/merge-style";
import { type ResponsiveStyle, type Style, StyleSchema } from "../schema";

export const BREAKPOINTS = ["base", "tablet", "mobile"] as const;
export type Breakpoint = (typeof BREAKPOINTS)[number];

/**
 * Style efektif di satu breakpoint (DM-036), desktop-first:
 * `effective(bp) = merge(base, tablet jika bp ∈ {tablet, mobile}, mobile jika bp = mobile)`,
 * dengan aturan merge yang sama dengan `updateStyle`.
 */
export function resolveStyle(style: ResponsiveStyle, breakpoint: Breakpoint): Style {
  if (breakpoint === "base") return style.base;

  let merged: Record<string, unknown> = { ...style.base };
  if (style.tablet) merged = mergeStyle(merged, style.tablet);
  if (breakpoint === "mobile" && style.mobile) merged = mergeStyle(merged, style.mobile);

  // Patch yang mengganti mode layout tanpa field wajib mode baru bisa menghasilkan style tidak valid;
  // saat itu breakpoint mewarisi `base` apa adanya agar render tidak rusak.
  const parsed = StyleSchema.safeParse(merged);
  return parsed.success ? parsed.data : style.base;
}
