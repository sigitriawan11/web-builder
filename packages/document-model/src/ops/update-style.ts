import * as Y from "yjs";
import { z } from "zod";
import { jsonEqual, normalizeOverrides } from "../query/normalize-overrides";
import { NodeIdSchema, type ResponsiveStyle, StylePatchSchema, StyleSchema } from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { mergeStyle } from "./merge-style";
import { defineOp, fail } from "./op";
import { nodesMap, nodeType, styleOf, type YNode } from "./y-access";

const BREAKPOINT_IDS = ["base", "tablet", "mobile"] as const;
const BreakpointSchema = z.enum(BREAKPOINT_IDS);

function hasHug(style: Record<string, unknown>): boolean {
  const size = style.size as { width?: { mode?: unknown }; height?: { mode?: unknown } } | undefined;
  return size?.width?.mode === "hug" || size?.height?.mode === "hug";
}

export const updateStyle = defineOp({
  name: "updateStyle",
  input: z.strictObject({
    ids: z.array(NodeIdSchema).min(1),
    breakpoint: BreakpointSchema.default("base"),
    patch: StylePatchSchema,
  }),
  run(ctx, input) {
    const nodes = nodesMap(ctx.doc);
    const { breakpoint, patch } = input;
    const resultSchema = breakpoint === "base" ? StyleSchema : StylePatchSchema;

    // Hitung & validasi hasil untuk semua node dulu; baru tulis jika semuanya valid.
    const planned: { yNode: YNode; style: ResponsiveStyle }[] = [];
    for (const [i, id] of input.ids.entries()) {
      const yNode = nodes.get(id);
      if (!yNode) return fail("NOT_FOUND", `Node "${id}" tidak ditemukan`, ["ids", i]);

      const current = styleOf(yNode).get(breakpoint)?.toJSON() ?? {};
      const next = mergeStyle(cloneJson(current), patch);
      const parsed = resultSchema.safeParse(next);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return fail("INVALID_RESULT", `Style "${id}" (${breakpoint}) tidak valid: ${issue?.message}`, [
          "patch",
          ...(issue?.path.map(String) ?? []),
        ]);
      }
      if (nodeType(yNode) === "image" && hasHug(next)) {
        return fail("INVALID_RESULT", `Image "${id}" tidak boleh memakai ukuran "hug" (DM-027)`, ["patch", "size"]);
      }
      // DM-036: normalisasi seluruh style node — perubahan base bisa membuat override tablet/mobile redundan.
      const full = { ...(styleOf(yNode).toJSON() as ResponsiveStyle), [breakpoint]: next };
      planned.push({ yNode, style: normalizeOverrides(full) });
    }

    for (const { yNode, style } of planned) {
      const yStyle = styleOf(yNode);
      for (const bp of BREAKPOINT_IDS) {
        const desired: Record<string, unknown> | undefined = style[bp];
        let yBreakpoint = yStyle.get(bp);
        // Patch breakpoint kosong dinormalisasi menjadi tidak ada (DM-036).
        if (!desired && bp !== "base") {
          if (yBreakpoint) yStyle.delete(bp);
          continue;
        }
        if (!yBreakpoint) {
          yBreakpoint = new Y.Map<unknown>();
          yStyle.set(bp, yBreakpoint);
        }
        // Hanya style group yang berubah yang ditulis, agar update Yjs tetap granular.
        const current = yBreakpoint.toJSON() as Record<string, unknown>;
        for (const group of new Set([...Object.keys(current), ...Object.keys(desired ?? {})])) {
          const value = desired?.[group];
          if (jsonEqual(current[group], value)) continue;
          if (value === undefined) yBreakpoint.delete(group);
          else yBreakpoint.set(group, cloneJson(value));
        }
      }
    }

    return { ok: true, value: undefined, affected: [...input.ids] };
  },
});
