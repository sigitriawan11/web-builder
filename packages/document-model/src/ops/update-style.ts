import * as Y from "yjs";
import { z } from "zod";
import { NodeIdSchema, StylePatchSchema, StyleSchema } from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { mergeStyle } from "./merge-style";
import { defineOp, fail } from "./op";
import { nodesMap, nodeType, styleOf, type YNode } from "./y-access";

const BreakpointSchema = z.enum(["base", "tablet", "mobile"]);

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
    const planned: { yNode: YNode; next: Record<string, unknown> }[] = [];
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
      planned.push({ yNode, next });
    }

    for (const { yNode, next } of planned) {
      const yStyle = styleOf(yNode);
      let yBreakpoint = yStyle.get(breakpoint);
      if (!yBreakpoint) {
        yBreakpoint = new Y.Map<unknown>();
        yStyle.set(breakpoint, yBreakpoint);
      }
      // Hanya style group yang disentuh patch yang ditulis, agar update Yjs tetap granular.
      for (const group of Object.keys(patch)) {
        const value = next[group];
        if (value === undefined) yBreakpoint.delete(group);
        else yBreakpoint.set(group, cloneJson(value));
      }
      // DM-036: patch breakpoint kosong dinormalisasi menjadi tidak ada.
      if (breakpoint !== "base" && yBreakpoint.size === 0) yStyle.delete(breakpoint);
    }

    return { ok: true, value: undefined, affected: [...input.ids] };
  },
});
