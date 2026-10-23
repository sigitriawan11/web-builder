import { COMMANDS, runCommand } from "@platform/document-model";
import { z } from "zod";
import { defineTool } from "../tool";
import { unwrapCommand } from "./command-error";

// AI-061 (mutation): tiap tool = SATU command di draft (origin `ai:<runId>`, lewat `ctx.commandCtx`). TIDAK memanipulasi
// Y.Map langsung. Error command → ToolError (unwrapCommand). Satu tool call = satu transaksi (atomic per tool).

const NodeId = z.string().regex(/^n_[0-9a-zA-Z_-]+$/, "nodeId (n_…)");

export const insertComponent = defineTool({
  name: "insert_component",
  description:
    "Insert a library component instance into a parent frame at an optional index. Use search_components first.",
  input: z.object({
    parentId: NodeId,
    componentId: z.string().regex(/^cmp_[0-9a-z]{6,24}$/, "componentId (cmp_…)"),
    version: z.number().int().nonnegative(),
    index: z.number().int().nonnegative().optional(),
  }),
  output: z.object({ nodeId: z.string() }),
  modes: ["user", "admin_library"],
  mutating: true,
  requires: { feature: "ai" },
  handler: (ctx, input) => {
    const { value } = unwrapCommand(runCommand(ctx.commandCtx, COMMANDS.createInstance, input));
    return { nodeId: value as string };
  },
});

export const updateNodeStyle = defineTool({
  name: "update_node_style",
  description:
    "Patch a node's style at one breakpoint (sparse; null removes an override). Does not replace whole style.",
  input: z.object({
    nodeId: NodeId,
    breakpoint: z.enum(["base", "tablet", "mobile"]).default("base"),
    patch: z.record(z.string(), z.unknown()),
  }),
  output: z.object({ nodeId: z.string() }),
  modes: ["user", "admin_library"],
  mutating: true,
  requires: { feature: "ai" },
  handler: (ctx, input) => {
    unwrapCommand(
      runCommand(ctx.commandCtx, COMMANDS.updateStyle, {
        ids: [input.nodeId],
        breakpoint: input.breakpoint,
        patch: input.patch,
      }),
    );
    return { nodeId: input.nodeId };
  },
});

export const updateText = defineTool({
  name: "update_text",
  description: "Replace a text node's content with plain text (one paragraph).",
  input: z.object({ nodeId: NodeId, text: z.string().max(20_000) }),
  output: z.object({ nodeId: z.string() }),
  modes: ["user", "admin_library"],
  mutating: true,
  requires: { feature: "ai" },
  handler: (ctx, input) => {
    unwrapCommand(runCommand(ctx.commandCtx, COMMANDS.setTextContent, { id: input.nodeId, content: input.text }));
    return { nodeId: input.nodeId };
  },
});

export const setProp = defineTool({
  name: "set_prop",
  description: "Set a prop value on a component instance (e.g. a heading text or a boolean toggle).",
  input: z.object({ instanceId: NodeId, key: z.string().min(1).max(64), value: z.unknown() }),
  output: z.object({ nodeId: z.string() }),
  modes: ["user", "admin_library"],
  mutating: true,
  requires: { feature: "ai" },
  handler: (ctx, input) => {
    unwrapCommand(
      runCommand(ctx.commandCtx, COMMANDS.setProp, { id: input.instanceId, key: input.key, value: input.value }),
    );
    return { nodeId: input.instanceId };
  },
});
