import { createBlankSiteDocument } from "@platform/document-model";
import { describe, expect, it, vi } from "vitest";
import type { RendererService } from "../renderer-service/renderer-service";
import { createRenderPreviewPort } from "./render-preview-port";

// T3.13.10: port render_preview worker — render doc → HTML → screenshot (renderer-service di-mock).

describe("createRenderPreviewPort (AI-186)", () => {
  it("render dokumen → screenshot dgn viewport benar", async () => {
    const screenshot = vi.fn(async () => Buffer.from("png-bytes"));
    const rendererService = { screenshot, close: async () => {} } as unknown as RendererService;
    const port = createRenderPreviewPort({ rendererService });

    const doc = createBlankSiteDocument({ title: "T", language: "en" });
    const pageId = doc.pageOrder[0] as string;

    const result = await port({ pageId, viewport: "mobile" }, doc);
    expect(result).toMatchObject({ width: 390, height: 844 });
    expect(result.bytes).toBe(Buffer.from("png-bytes").length);
    // HTML non-kosong + viewport mobile diteruskan ke screenshot.
    const call = (screenshot.mock.calls[0] as unknown[] | undefined)?.[0] as {
      html: string;
      viewport: { width: number };
    };
    expect(call.viewport.width).toBe(390);
    expect(call.html).toContain("<html");
  });
});
