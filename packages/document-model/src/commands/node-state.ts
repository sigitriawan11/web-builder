import * as Y from "yjs";
import { z } from "zod";
import { jsonEqual } from "../query/normalize-overrides";
import { StateStylePatchSchema } from "../schema/style";
import { NodeIdSchema } from "../schema/values";
import { cloneJson } from "../yjs/clone-json";
import { defineCommand, fail } from "./command";
import { nodesMap, styleOf, type YNode } from "./y-access";

// DM-040/CMP-032: edit style delta per interaction state (hover/pressed/focus/disabled) di `style.states.<state>`.
// Renderer mengubahnya jadi pseudo-class (:hover/:focus-visible/:active/[aria-disabled], T3.2.2). Ini primitif
// authoring (dipakai Inspector Mode Admin & AI); toggle "Preview state" di canvas = follow-up.

const STATES = ["hover", "pressed", "focus", "disabled"] as const;
const BREAKPOINTS = ["base", "tablet", "mobile"] as const;

/** Y.Map `style.states.<state>.<breakpoint>` (dibuat bila belum ada). */
function stateBreakpointMap(yNode: YNode, state: string, breakpoint: string): Y.Map<unknown> {
  const yStyle = styleOf(yNode) as unknown as Y.Map<unknown>;
  const ensure = (parent: Y.Map<unknown>, key: string): Y.Map<unknown> => {
    const existing = parent.get(key);
    if (existing instanceof Y.Map) return existing as Y.Map<unknown>;
    const created = new Y.Map<unknown>();
    parent.set(key, created);
    return created;
  };
  return ensure(ensure(ensure(yStyle, "states"), state), breakpoint);
}

// CMP-032: set style delta satu state (merge per group; nilai `null` menghapus group).
export const setNodeState = defineCommand({
  name: "setNodeState",
  description: { id: "Set style state node (hover/focus/…).", en: "Set a node's state style." },
  aiExposed: true,
  input: z.strictObject({
    id: NodeIdSchema,
    state: z.enum(STATES),
    breakpoint: z.enum(BREAKPOINTS).default("base"),
    patch: StateStylePatchSchema,
  }),
  run(ctx, input) {
    const node = nodesMap(ctx.doc).get(input.id);
    if (!node)
      return fail("NOT_FOUND", { id: `Node "${input.id}" tidak ada`, en: `Node "${input.id}" not found` }, ["id"]);
    const target = stateBreakpointMap(node, input.state, input.breakpoint);
    for (const [group, value] of Object.entries(input.patch)) {
      if (value === null || value === undefined) target.delete(group);
      else if (!jsonEqual(target.get(group), value)) target.set(group, cloneJson(value));
    }
    return { ok: true, value: undefined, affected: [input.id] };
  },
});

// Hapus satu state penuh (atau satu breakpoint-nya) dari node.
export const clearNodeState = defineCommand({
  name: "clearNodeState",
  description: { id: "Hapus style state node.", en: "Clear a node's state style." },
  aiExposed: true,
  input: z.strictObject({
    id: NodeIdSchema,
    state: z.enum(STATES),
    breakpoint: z.enum(BREAKPOINTS).optional(),
  }),
  run(ctx, input) {
    const node = nodesMap(ctx.doc).get(input.id);
    if (!node)
      return fail("NOT_FOUND", { id: `Node "${input.id}" tidak ada`, en: `Node "${input.id}" not found` }, ["id"]);
    const yStyle = styleOf(node) as unknown as Y.Map<unknown>;
    const yStates = yStyle.get("states");
    if (yStates instanceof Y.Map) {
      if (input.breakpoint) {
        const yState = yStates.get(input.state);
        if (yState instanceof Y.Map) {
          yState.delete(input.breakpoint);
          if (yState.size === 0) yStates.delete(input.state);
        }
      } else {
        yStates.delete(input.state);
      }
      if (yStates.size === 0) yStyle.delete("states");
    }
    return { ok: true, value: undefined, affected: [input.id] };
  },
});
