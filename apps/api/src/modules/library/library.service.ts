import type { Db } from "@platform/db";
import { AppError } from "@platform/shared";
import { stableHash } from "@platform/shared/node";
import {
  findPublishedDefinition,
  type LibraryDefinition,
  type LibraryListItem,
  listPublishedComponents,
} from "./library.repository";

// Service library baca (editor/publish). Versi published tidak ada → 404 (component/versi hilang tidak crash halaman).
export function createLibraryService(deps: { db: Db }) {
  return {
    async getDefinition(componentId: string, version: number): Promise<LibraryDefinition> {
      const found = await findPublishedDefinition(deps.db, componentId, version);
      if (!found) throw new AppError("NOT_FOUND");
      // CMP-044: integritas — definisi versi published immutable; hash kanonik harus cocok (deteksi korupsi/tamper).
      if (found.contentHash && stableHash(found.definition) !== found.contentHash)
        throw new AppError("INTERNAL_ERROR", undefined, { reason: "integrity_hash_mismatch", componentId, version });
      return found;
    },

    // T3.6.1: daftar component published (panel Insert editor), filter kategori/pencarian opsional.
    async listComponents(filter: { category?: string; search?: string }): Promise<LibraryListItem[]> {
      return listPublishedComponents(deps.db, filter);
    },
  };
}

export type LibraryService = ReturnType<typeof createLibraryService>;
