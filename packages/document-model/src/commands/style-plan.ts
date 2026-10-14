import { z } from "zod";
import { normalizeOverrides } from "../query/normalize-overrides";
import { NodeSchema, type ResponsiveStyle, StylePatchSchema, StyleSchema } from "../schema";
import { checkNodeStyle } from "../validate/invariants";
import type { Issue } from "../validate/issues";
import { cloneJson } from "../yjs/clone-json";
import { yNodeToJson } from "../yjs/mapping";
import { type CommandFailure, fail } from "./command";
import { writeStyle } from "./post-check";
import { nodesMap, styleOf, type YNode } from "./y-access";

// Perencana bersama command style (DM-074/DM-036): hitung style baru per node, validasi semuanya, baru tulis.

export const BREAKPOINT_IDS = ["base", "tablet", "mobile"] as const;
export const BreakpointSchema = z.enum(BREAKPOINT_IDS);
export type BreakpointId = z.infer<typeof BreakpointSchema>;

type StyleTransform = (style: ResponsiveStyle, yNode: YNode) => ResponsiveStyle;

/**
 * Terapkan `transform` ke style setiap node: hasil per breakpoint divalidasi (base = `StyleSchema`, override =
 * `StylePatchSchema`), invariant style node dicek, lalu override redundan dinormalisasi. Tidak menulis apa pun bila
 * satu node gagal.
 */
export function planStyles(
  ctx: { doc: import("yjs").Doc },
  ids: readonly string[],
  transform: StyleTransform,
): { yNode: YNode; style: ResponsiveStyle }[] | CommandFailure {
  const nodes = nodesMap(ctx.doc);
  const planned: { yNode: YNode; style: ResponsiveStyle }[] = [];
  for (const [i, id] of ids.entries()) {
    const yNode = nodes.get(id);
    if (!yNode)
      return fail("NOT_FOUND", { id: `Node "${id}" tidak ditemukan`, en: `Node "${id}" not found` }, ["ids", i]);
    const current = cloneJson(styleOf(yNode).toJSON()) as ResponsiveStyle;
    const next = transform(current, yNode);
    for (const bp of BREAKPOINT_IDS) {
      const value = next[bp];
      if (value === undefined) continue;
      const parsed = (bp === "base" ? StyleSchema : StylePatchSchema).safeParse(value);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return fail(
          "INVALID_RESULT",
          {
            id: `Style "${id}" (${bp}) tidak valid: ${issue?.message}`,
            en: `Invalid style for "${id}" (${bp}): ${issue?.message}`,
          },
          ["style", bp, ...(issue?.path.filter((key): key is string | number => typeof key !== "symbol") ?? [])],
        );
      }
    }
    const node = NodeSchema.safeParse({ ...yNodeToJson(yNode), style: next });
    if (!node.success) {
      const issue = node.error.issues[0];
      return fail(
        "INVALID_RESULT",
        { id: `Node "${id}" tidak valid: ${issue?.message}`, en: `Node "${id}" would be invalid: ${issue?.message}` },
        issue?.path.filter((key): key is string | number => typeof key !== "symbol"),
      );
    }
    const issues: Issue[] = [];
    checkNodeStyle(node.data, (code, path, message) => issues.push({ code, path, message }));
    const [first] = issues;
    if (first) return fail("INVALID_RESULT", first.message, first.path, { invariant: first.code });
    planned.push({ yNode, style: normalizeOverrides(next) });
  }
  return planned;
}

export function writePlannedStyles(planned: readonly { yNode: YNode; style: ResponsiveStyle }[]): void {
  for (const { yNode, style } of planned) writeStyle(yNode, style);
}
