import { describe, expect, it } from "vitest";
import type { ToolContext } from "../tool";
import type { AiToolPorts } from "./ports";
import { renderPreview } from "./render";

// T3.13.10 (AI-186): render_preview memanggil port renderPreview; tanpa port → UPSTREAM_ERROR.

function ctxWith(ports: AiToolPorts): ToolContext {
  return {
    commandCtx: {} as ToolContext["commandCtx"],
    readDocument: () => ({ nodes: {} }),
    mode: "user",
    runId: "r",
    ports: ports as Record<string, unknown>,
  };
}

describe("render_preview (AI-186)", () => {
  it("memanggil port → dimensi + note", async () => {
    const ctx = ctxWith({
      renderPreview: async (input) => ({
        width: input.viewport === "mobile" ? 390 : 1280,
        height: 800,
        bytes: 42,
        note: "ok",
      }),
    });
    const res = await renderPreview.run(ctx, { pageId: "pg_home", viewport: "mobile" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output).toMatchObject({ width: 390, note: "ok" });
  });

  it("tanpa port → UPSTREAM_ERROR", async () => {
    const res = await renderPreview.run(ctxWith({}), { pageId: "pg_home" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("UPSTREAM_ERROR");
  });
});
