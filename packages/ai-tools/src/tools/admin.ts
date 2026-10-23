import { COMMANDS, runCommand } from "@platform/document-model";
import { z } from "zod";
import { ToolError } from "../errors";
import { defineTool, type Tool } from "../tool";
import { unwrapCommand } from "./command-error";
import type { AiToolPorts } from "./ports";

// AI-006 (admin, mode admin_library saja): produksi library. `admin_create_component_draft` membuat draft component
// baru (lewat port); `admin_add_variant` menambah variant axis ke definisi component draft aktif (command API).
// Publish tetap aksi manusia. Tool admin TIDAK terdaftar di mode user (modes=["admin_library"]).

const Localized = z.object({ id: z.string().min(1), en: z.string().min(1) });

export const adminCreateComponentDraft = defineTool({
  name: "admin_create_component_draft",
  description: "Create a new library component DRAFT (admin only). Publishing stays a human action.",
  input: z.object({
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "slug kebab-case"),
    kind: z.enum(["element", "block", "section", "page", "layout"]),
    name: z.string().min(1).max(64),
    displayName: Localized,
    description: Localized,
    definition: z.unknown(),
  }),
  output: z.object({ componentId: z.string(), publicId: z.string() }),
  modes: ["admin_library"],
  mutating: true,
  requires: { feature: "ai" },
  handler: async (ctx, input) => {
    const create = (ctx.ports as AiToolPorts).createComponentDraft;
    if (!create) throw new ToolError("UPSTREAM_ERROR", "component draft creation is unavailable in this run");
    return create(input);
  },
});

export const adminAddVariant = defineTool({
  name: "admin_add_variant",
  description: "Add a variant axis (e.g. tone: [primary, secondary]) to the component definition draft (admin only).",
  input: z.object({
    name: z.string().min(1).max(64),
    options: z.array(z.string().min(1).max(64)).min(2).max(6),
    default: z.string().min(1).max(64),
  }),
  output: z.object({ axis: z.string() }),
  modes: ["admin_library"],
  mutating: true,
  requires: { feature: "ai" },
  handler: (ctx, input) => {
    if (!input.options.includes(input.default)) {
      throw new ToolError("INVALID_INPUT", `default '${input.default}' is not one of options`, {
        details: { options: input.options },
      });
    }
    unwrapCommand(
      runCommand(ctx.commandCtx, COMMANDS.addVariantAxis, {
        name: input.name,
        options: input.options,
        default: input.default,
      }),
    );
    return { axis: input.name };
  },
});

/** Tool admin (mode admin_library). Didaftarkan terpisah dari BASE_TOOLS (hanya untuk run admin). */
export const ADMIN_TOOLS: Tool[] = [adminCreateComponentDraft, adminAddVariant];
