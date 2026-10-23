import type { AiToolPorts } from "@platform/ai-tools";
import type { SiteDocument } from "@platform/document-model";
import { renderToStaticHtml } from "@platform/renderer";
import type { RendererService } from "../renderer-service/renderer-service";

// AI-186: implementasi port `render_preview` di worker — render dokumen (draft) → HTML (renderer) → screenshot
// (renderer-service Chromium). Tool ai-tools tetap murni; efek samping (Chromium) di sini.

// Lebar viewport desktop/mobile (selaras breakpoint renderer).
const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

export function createRenderPreviewPort(deps: {
  rendererService: RendererService;
  assetUrl?: (assetId: string) => string;
}): NonNullable<AiToolPorts["renderPreview"]> {
  return async (input, document) => {
    const page = renderToStaticHtml(document as SiteDocument, input.pageId, { assetUrl: deps.assetUrl ?? (() => "") });
    const viewport = VIEWPORTS[input.viewport];
    const png = await deps.rendererService.screenshot({ html: page.html, viewport, fullPage: false });
    return {
      width: viewport.width,
      height: viewport.height,
      bytes: png.length,
      note: `Rendered ${input.viewport} preview (${viewport.width}×${viewport.height}, ${png.length} bytes).`,
    };
  };
}
