import type { Db } from "@platform/db";
import { ComponentDefinitionSchema } from "@platform/document-model";
import { renderComponentPreview } from "@platform/renderer";
import sharp from "sharp";
import type { ImageStorage } from "../../lib/storage";
import type { RendererService } from "../../renderer-service";
import type { JobHandler } from "../types";
import * as repository from "./thumbnails.repository";

// Processor queue `thumbnails` (CMP-014): render versi component published → PNG per breakpoint → bucket `assets` +
// catat ref di `component_version_thumbnails`. Idempoten (upsert; re-run menimpa). Thumbnail page situs (`document`)
// = M4. Butuh renderer-service (Chromium). Dedupe oleh producer via `componentThumbnailJobId`.

// previewWidth DEFAULT_BREAKPOINTS (document-model): desktop/tablet/mobile. Tinggi nominal; `fullPage` menangkap konten.
const BREAKPOINTS = [
  { name: "base", width: 1440 },
  { name: "tablet", width: 768 },
  { name: "mobile", width: 390 },
] as const;
const VIEWPORT_HEIGHT = 900;

export interface ThumbnailsDeps {
  db: Db;
  storage: ImageStorage;
  renderer: RendererService;
  // Resolusi assetId → URL untuk gambar di dalam component (best-effort; gambar library = follow-up). Default: id apa adanya.
  assetUrl?: (assetId: string) => string;
}

export function createThumbnailsProcessor(deps: ThumbnailsDeps): JobHandler<"thumbnails"> {
  const { db, storage, renderer } = deps;
  const assetUrl = deps.assetUrl ?? ((id: string) => id);

  return async (payload, { logger }) => {
    if (payload.target !== "component") {
      logger.info({ target: payload.target }, "thumbnail page situs belum didukung (M4); dilewati");
      return;
    }
    const version = await repository.findPublishedComponentVersion(db, payload.componentVersionId);
    if (!version) {
      logger.warn({ componentVersionId: payload.componentVersionId }, "versi tak ada / belum published; dilewati");
      return;
    }
    const parsed = ComponentDefinitionSchema.safeParse(version.definition);
    if (!parsed.success) {
      logger.warn({ componentVersionId: version.id }, "definisi component tak valid; dilewati");
      return;
    }

    const { html } = renderComponentPreview(parsed.data, { assetUrl });
    for (const breakpoint of BREAKPOINTS) {
      const png = await renderer.screenshot({
        html,
        viewport: { width: breakpoint.width, height: VIEWPORT_HEIGHT },
        fullPage: true,
      });
      const key = `thumbnails/components/${version.id}/${breakpoint.name}.png`;
      await storage.putObject({ bucket: storage.assetsBucket, key, body: png, contentType: "image/png" });
      const meta = await sharp(png).metadata();
      await repository.upsertThumbnail(db, {
        componentVersionId: version.id,
        breakpoint: breakpoint.name,
        assetKey: key,
        width: meta.width ?? breakpoint.width,
        height: meta.height ?? VIEWPORT_HEIGHT,
      });
    }
    logger.info({ componentVersionId: version.id }, "thumbnail component siap (3 breakpoint)");
  };
}
