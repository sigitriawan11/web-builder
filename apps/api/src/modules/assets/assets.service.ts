import type { Db, SiteTenant } from "@platform/db";
import { createId } from "@platform/document-model";
import { AppError } from "@platform/shared";
import {
  type AssetSummary,
  assetKindForMime,
  type PresignUploadRequest,
  type PresignUploadResponse,
} from "@platform/shared/contracts";
import type { AssetStorage } from "../../lib/storage";
import { assertCan } from "../../permissions";
import type { QueueProducer } from "../../queues/producer";
import * as repository from "./assets.repository";

// Logika upload aset (ARCHITECTURE §9.9): presign PUT + record pending → client PUT ke storage → complete → job
// image-processing (worker) → status ready/rejected. Resource lintas-tenant = NOT_FOUND (tidak bocor).

function toSummary(row: repository.AssetRow): AssetSummary {
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.fileName,
    mime: row.mime,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    blurhash: row.blurhash,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

// Pustaka media (ED-161): batasi jumlah agar respons ringan; paginasi lanjut menyusul bila perlu.
const LIST_LIMIT = 200;

export function createAssetsService(deps: { db: Db; storage: AssetStorage; queues?: QueueProducer }) {
  const { db, storage } = deps;
  return {
    /** Buat presigned PUT + record aset `pending`. mime/ukuran sudah divalidasi schema di boundary. */
    async presign(tenant: SiteTenant, input: PresignUploadRequest, requestId: string): Promise<PresignUploadResponse> {
      assertCan(tenant, "site.edit");
      const kind = assetKindForMime(input.mime);
      if (!kind) throw new AppError("VALIDATION_FAILED", 422, { field: "mime" });
      const assetId = createId("ast");
      // Key prefix per workspace (ARCHITECTURE §9.9): `uploads/<workspaceId>/<assetId>`.
      const storageKey = `uploads/${tenant.workspaceId}/${assetId}`;
      void requestId; // dipakai saat complete (job); presign tidak enqueue.
      await repository.insertPending(tenant, db, {
        id: assetId,
        kind,
        storageKey,
        fileName: input.fileName ?? null,
        mime: input.mime,
        sizeBytes: input.sizeBytes,
        uploadedBy: tenant.actor.userId,
      });
      const uploadUrl = await storage.presignUpload({
        key: storageKey,
        contentType: input.mime,
        contentLength: input.sizeBytes,
      });
      return { assetId, storageKey, uploadUrl, headers: { "Content-Type": input.mime } };
    },

    /** Dipanggil setelah PUT selesai → antre job image-processing (verifikasi + varian). Idempoten. */
    async complete(tenant: SiteTenant, assetId: string, requestId: string): Promise<AssetSummary> {
      assertCan(tenant, "site.edit");
      const row = await repository.findScoped(tenant, db, assetId);
      if (!row) throw new AppError("NOT_FOUND");
      if (row.status === "pending" && deps.queues) {
        // Enqueue setelah commit (konsistensi); di sini tanpa transaksi tulis, jadi enqueue langsung aman.
        await deps.queues.enqueue("image-processing", { requestId, assetId });
      }
      return toSummary(row);
    },

    /** Dipakai int test & media library (T2.12.4). */
    async get(tenant: SiteTenant, assetId: string): Promise<AssetSummary> {
      assertCan(tenant, "site.read");
      const row = await repository.findScoped(tenant, db, assetId);
      if (!row) throw new AppError("NOT_FOUND");
      return toSummary(row);
    },

    /** Pustaka media situs (ED-161): daftar aset (terbaru dulu), opsional difilter nama file. */
    async list(tenant: SiteTenant, options: { search?: string }): Promise<AssetSummary[]> {
      assertCan(tenant, "site.read");
      const rows = await repository.listScoped(tenant, db, {
        ...(options.search ? { search: options.search } : {}),
        limit: LIST_LIMIT,
      });
      return rows.map(toSummary);
    },

    /** Hapus aset dari pustaka (soft delete; objek storage di-GC saat purge). */
    async remove(tenant: SiteTenant, assetId: string): Promise<void> {
      assertCan(tenant, "site.edit");
      const removed = await repository.softDelete(tenant, db, assetId);
      if (!removed) throw new AppError("NOT_FOUND");
    },

    /** URL presigned GET varian webp aset `ready` — disajikan `<img>` editor (ED-161). Null jika belum siap. */
    async contentUrl(tenant: SiteTenant, assetId: string): Promise<string | null> {
      assertCan(tenant, "site.read");
      const row = await repository.findScoped(tenant, db, assetId);
      if (row?.status !== "ready") return null;
      const variants = (row.variants ?? {}) as Record<string, unknown>;
      const webpKey = variants.webp;
      if (typeof webpKey !== "string") return null;
      return storage.presignDownload({ key: webpKey });
    },
  };
}

export type AssetsService = ReturnType<typeof createAssetsService>;
