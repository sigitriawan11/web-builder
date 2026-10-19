import type { Db } from "@platform/db";
import { AppError } from "@platform/shared";
import { findPublishedDefinition, type LibraryDefinition } from "./library.repository";

// Service library baca (editor/publish). Versi published tidak ada → 404 (component/versi hilang tidak crash halaman).
export function createLibraryService(deps: { db: Db }) {
  return {
    async getDefinition(componentId: string, version: number): Promise<LibraryDefinition> {
      const found = await findPublishedDefinition(deps.db, componentId, version);
      if (!found) throw new AppError("NOT_FOUND");
      return found;
    },
  };
}

export type LibraryService = ReturnType<typeof createLibraryService>;
