import type { Db } from "@platform/db";
import { AppError } from "@platform/shared";
import { stableHash } from "@platform/shared/node";
import type { AssetStorage } from "../../lib/storage";
import { findPublishedDefinition, type LibraryDefinition, listPublishedComponents } from "./library.repository";

// Item daftar yang dikembalikan ke client (tanpa `thumbnailKey` internal; `thumbnailUrl` sudah presigned).
export interface LibraryListItemPublic {
  publicId: string;
  name: string;
  displayName: { id: string; en: string };
  categorySlug: string;
  kind: string;
  version: number;
  thumbnailUrl: string | null;
}

// Service library baca (editor/publish). Versi published tidak ada → 404 (component/versi hilang tidak crash halaman).
export function createLibraryService(deps: { db: Db; storage?: AssetStorage }) {
  return {
    async getDefinition(componentId: string, version: number): Promise<LibraryDefinition> {
      const found = await findPublishedDefinition(deps.db, componentId, version);
      if (!found) throw new AppError("NOT_FOUND");
      // CMP-044: integritas — definisi versi published immutable; hash kanonik harus cocok (deteksi korupsi/tamper).
      if (found.contentHash && stableHash(found.definition) !== found.contentHash)
        throw new AppError("INTERNAL_ERROR", undefined, { reason: "integrity_hash_mismatch", componentId, version });
      return found;
    },

    // T3.6.1/T3.7.3: daftar component published (panel Insert editor); thumbnail `base` di-presign (CMP-014) bila ada.
    async listComponents(filter: { category?: string; search?: string }): Promise<LibraryListItemPublic[]> {
      const rows = await listPublishedComponents(deps.db, filter);
      const storage = deps.storage;
      return Promise.all(
        rows.map(async ({ thumbnailKey, ...item }) => ({
          ...item,
          thumbnailUrl:
            thumbnailKey && storage
              ? await storage.presignDownload({ key: thumbnailKey, bucket: storage.assetsBucket })
              : item.thumbnailUrl,
        })),
      );
    },
  };
}

export type LibraryService = ReturnType<typeof createLibraryService>;
