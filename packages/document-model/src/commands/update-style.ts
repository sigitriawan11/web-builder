import { z } from "zod";
import { normalizeOverrides } from "../query/normalize-overrides";
import { NodeIdSchema, type ResponsiveStyle, StylePatchSchema, StyleSchema } from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { defineCommand, fail } from "./command";
import { mergeStyle } from "./merge-style";
import { writeStyle } from "./post-check";
import { nodesMap, nodeType, styleOf, type YNode } from "./y-access";

const BREAKPOINT_IDS = ["base", "tablet", "mobile"] as const;
const BreakpointSchema = z.enum(BREAKPOINT_IDS);

function hasHug(style: Record<string, unknown>): boolean {
  const size = style.size as { width?: { mode?: unknown }; height?: { mode?: unknown } } | undefined;
  return size?.width?.mode === "hug" || size?.height?.mode === "hug";
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
      if (!yNode)
        return fail("NOT_FOUND", { id: `Node "${id}" tidak ditemukan`, en: `Node "${id}" not found` }, ["ids", i]);

      const current = styleOf(yNode).get(breakpoint)?.toJSON() ?? {};
      const next = mergeStyle(cloneJson(current), patch);
      const parsed = resultSchema.safeParse(next);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return fail(
          "INVALID_RESULT",
          {
            id: `Style "${id}" (${breakpoint}) tidak valid: ${issue?.message}`,
            en: `Invalid style for "${id}" (${breakpoint}): ${issue?.message}`,
          },
          ["patch", ...(issue?.path.map(String) ?? [])],
        );
      }
      if (nodeType(yNode) === "image" && hasHug(next)) {
        return fail(
          "INVALID_RESULT",
          { id: `Image "${id}" tidak boleh memakai ukuran "hug"`, en: `Image "${id}" cannot use "hug" sizing` },
          ["patch", "size"],
        );
      }
      // DM-036: normalisasi seluruh style node — perubahan base bisa membuat override tablet/mobile redundan.
      const full = { ...(styleOf(yNode).toJSON() as ResponsiveStyle), [breakpoint]: next };
      planned.push({ yNode, style: normalizeOverrides(full) });
    }

    for (const { yNode, style } of planned) writeStyle(yNode, style);

    return { ok: true, value: undefined, affected: [...input.ids] };
  },
});
