import { z } from "zod";
import { NodeIdSchema, type ResponsiveStyle, type StylePatch, StylePatchSchema } from "../schema";
import { defineCommand } from "./command";
import { mergeStyle } from "./merge-style";
import { BreakpointSchema, planStyles, writePlannedStyles } from "./style-plan";

/** Terapkan patch sparse ke satu breakpoint style dengan aturan merge DM-036 (`null` = hapus override). */
export function patchBreakpoint(
  style: ResponsiveStyle,
  breakpoint: "base" | "tablet" | "mobile",
  patch: StylePatch,
): ResponsiveStyle {
  const current = (style[breakpoint] ?? {}) as Record<string, unknown>;
  // Hasil merge divalidasi `planStyles`; tipe dilonggarkan di sini karena merge bekerja pada JSON.
  return { ...style, [breakpoint]: mergeStyle(current, patch) } as ResponsiveStyle;
}

export const updateStyle = defineCommand({
  name: "updateStyle",
  description: {
    id: "Ubah style node di satu breakpoint (patch sparse; null = hapus override, kembali mewarisi).",
    en: "Change node style at one breakpoint (sparse patch; null = remove override and inherit again).",
  },
  aiExposed: true,
  input: z.strictObject({
    ids: z.array(NodeIdSchema).min(1),
    breakpoint: BreakpointSchema.default("base"),
    // `state` (hover/pressed, DM-040) ditambah bersama fiturnya (M2).
    patch: StylePatchSchema,
  }),
  run(ctx, input) {
    const planned = planStyles(ctx, input.ids, (style) => patchBreakpoint(style, input.breakpoint, input.patch));
    if (!Array.isArray(planned)) return planned;
    writePlannedStyles(planned);
    return { ok: true, value: undefined, affected: [...input.ids] };
  },
});
