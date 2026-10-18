import type { Db } from "@platform/db";
import type { ImageStorage } from "../../lib/storage";
import type { JobHandler } from "../types";
import { processRasterImage } from "./image-ops";
import * as repository from "./image-processing.repository";

// Processor queue `image-processing` (ARCHITECTURE §9.9): unduh file mentah → cek & proses (varian WebP/AVIF, blurhash,
// dimensi, sha256, strip EXIF) → unggah varian → status `ready`. File rusak / bukan gambar valid → `rejected` (retry
// tidak membantu). SVG butuh sanitasi (DOMPurify) → ditolak dulu sampai sanitasi dibuat (keamanan, tidak serve mentah).

export interface ImageProcessingDeps {
  db: Db;
  storage: ImageStorage;
}

export function createImageProcessingProcessor(deps: ImageProcessingDeps): JobHandler<"image-processing"> {
  const { db, storage } = deps;
  return async (payload, { logger }) => {
    const asset = await repository.findAsset(db, payload.assetId);
    if (!asset) {
      logger.warn({ assetId: payload.assetId }, "aset tidak ditemukan; dilewati");
      return;
    }
    if (asset.status !== "pending") {
      logger.info({ assetId: asset.id, status: asset.status }, "aset bukan pending; idempoten, dilewati");
      return;
    }
    if (asset.kind === "svg") {
      // Sanitasi SVG (DOMPurify server-side) belum ada — tolak agar tidak menyajikan SVG mentah (risiko XSS).
      logger.warn({ assetId: asset.id }, "svg ditolak sementara (sanitasi belum tersedia)");
      await repository.markRejected(db, asset.id);
      return;
    }

    let processed: Awaited<ReturnType<typeof processRasterImage>>;
    try {
      const input = await storage.getObject(storage.uploadsBucket, asset.storageKey);
      processed = await processRasterImage(input);
    } catch (error) {
      // File rusak / bukan gambar valid: tolak (bukan error job — retry tidak membantu).
      logger.warn({ assetId: asset.id, err: error }, "gambar gagal diproses; ditolak");
      await repository.markRejected(db, asset.id);
      return;
    }

    const prefix = `assets/${asset.workspaceId}/${asset.id}`;
    const webpKey = `${prefix}/full.webp`;
    const avifKey = `${prefix}/full.avif`;
    await Promise.all([
      storage.putObject({
        bucket: storage.assetsBucket,
        key: webpKey,
        body: processed.webp,
        contentType: "image/webp",
      }),
      storage.putObject({
        bucket: storage.assetsBucket,
        key: avifKey,
        body: processed.avif,
        contentType: "image/avif",
      }),
    ]);
    await repository.markReady(db, asset, {
      width: processed.width,
      height: processed.height,
      blurhash: processed.blurhash,
      sha256: processed.sha256,
      variants: { webp: webpKey, avif: avifKey },
    });
    logger.info({ assetId: asset.id, width: processed.width, height: processed.height }, "gambar siap");
  };
}
