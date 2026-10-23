import { z } from "zod";
import { ToolError } from "../errors";
import { defineTool } from "../tool";
import type { AiToolPorts } from "./ports";

// AI-061 (library): cari component published. Efek samping lewat port `searchComponents` (di-inject worker).

export const searchComponents = defineTool({
  name: "search_components",
  description:
    "Search the published component library by text and/or category. Returns componentId + version to insert.",
  input: z.object({
    query: z.string().max(200).optional(),
    category: z.string().max(64).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  output: z.object({
    components: z.array(
      z.object({
        componentId: z.string(),
        name: z.string(),
        version: z.number().int(),
        categorySlug: z.string().optional(),
      }),
    ),
  }),
  modes: ["user", "admin_library"],
  mutating: false,
  handler: async (ctx, input) => {
    const search = (ctx.ports as AiToolPorts).searchComponents;
    if (!search) throw new ToolError("UPSTREAM_ERROR", "component search is unavailable in this run");
    const components = await search({
      ...(input.query !== undefined ? { query: input.query } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      limit: input.limit,
    });
    return { components };
  },
});
