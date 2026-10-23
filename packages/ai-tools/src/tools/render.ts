import { z } from "zod";
import { ToolError } from "../errors";
import { defineTool } from "../tool";
import type { AiToolPorts } from "./ports";

// AI-186: render screenshot halaman (desktop/mobile) untuk self-check kualitas sebelum `finish`. Port `renderPreview`
// di-inject worker (render doc → HTML via renderer → screenshot renderer-service). Budget `maxRenders` dijaga runner.

export const renderPreview = defineTool({
  name: "render_preview",
  description: "Render a screenshot of a page at desktop or mobile width to self-check layout before finishing.",
  input: z.object({
    pageId: z.string(),
    viewport: z.enum(["desktop", "mobile"]).default("desktop"),
  }),
  output: z.object({
    width: z.number().int(),
    height: z.number().int(),
    imageRef: z.string().optional(),
    note: z.string().optional(),
  }),
  modes: ["user", "admin_library"],
  mutating: false,
  requires: { feature: "ai" },
  handler: async (ctx, input) => {
    const render = (ctx.ports as AiToolPorts).renderPreview;
    if (!render) throw new ToolError("UPSTREAM_ERROR", "render preview is unavailable in this run");
    const result = await render(input, ctx.readDocument());
    return {
      width: result.width,
      height: result.height,
      ...(result.imageRef ? { imageRef: result.imageRef } : {}),
      ...(result.note ? { note: result.note } : {}),
    };
  },
});
