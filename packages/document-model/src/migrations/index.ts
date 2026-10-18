import type * as Y from "yjs";
import { CURRENT_SCHEMA_VERSION, SiteDocumentSchema } from "../schema";
import { cloneJson } from "../yjs/clone-json";
import { YDOC_KEYS, yDocToJson } from "../yjs/mapping";
import { systemOrigin } from "../yjs/origin";
import { restoreDocument } from "../yjs/storage";
import { v0ToV1 } from "./v0-to-v1";
import { v1ToV2 } from "./v1-to-v2";
import { v2ToV3 } from "./v2-to-v3";
import { v3ToV4 } from "./v3-to-v4";
import { v4ToV5 } from "./v4-to-v5";

// DM-071: migrasi berurutan — `MIGRATIONS[n]` mengubah vN → vN+1. Murni, tanpa I/O. Migrasi tidak boleh menghapus
// data user tanpa jejak (pindahkan ke `metadata.ext.migrated` bila tidak bisa dipetakan).

export type JsonRecord = Record<string, unknown>;
export type Migration = (doc: JsonRecord) => JsonRecord;

export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  0: v0ToV1,
  1: v1ToV2,
  2: v2ToV3,
  3: v3ToV4,
  4: v4ToV5,
};

export type MigrationErrorCode = "INVALID_DOCUMENT" | "FUTURE_VERSION" | "MISSING_MIGRATION";

export class MigrationError extends Error {
  constructor(
    readonly code: MigrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MigrationError";
  }
}

export interface MigrationResult {
  document: JsonRecord;
  fromVersion: number;
  toVersion: number;
  // Versi sumber setiap langkah yang dijalankan (kosong = sudah terkini).
  applied: number[];
}

/**
 * Migrasikan JSON dokumen ke `CURRENT_SCHEMA_VERSION` (DM-071). Idempoten untuk dokumen terkini. Versi di atas
 * terkini → `FUTURE_VERSION` (editor/server lama harus reload/upgrade, bukan menulis ulang). Hasil BELUM divalidasi:
 * pemanggil menjalankan `validateDocument`/`SiteDocumentSchema`.
 */
export function migrateDocument(
  input: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): MigrationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new MigrationError("INVALID_DOCUMENT", "Dokumen harus objek JSON");
  }
  const version = (input as JsonRecord).schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    throw new MigrationError("INVALID_DOCUMENT", "schemaVersion harus bilangan bulat ≥ 0");
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new MigrationError(
      "FUTURE_VERSION",
      `Dokumen v${version} lebih baru dari kode ini (v${CURRENT_SCHEMA_VERSION}); muat ulang aplikasi`,
    );
  }

  let document = cloneJson(input) as JsonRecord;
  const applied: number[] = [];
  for (let current = version; current < CURRENT_SCHEMA_VERSION; current++) {
    const migration = migrations[current];
    if (!migration) {
      throw new MigrationError("MISSING_MIGRATION", `Tidak ada migrasi v${current} → v${current + 1}`);
    }
    document = { ...migration(document), schemaVersion: current + 1 };
    applied.push(current);
  }
  return { document, fromVersion: version, toVersion: CURRENT_SCHEMA_VERSION, applied };
}

/**
 * Migrasi dokumen aktif di Y.Doc (alur load server, DM-071): `yDocToJson` → `migrateDocument` → validasi →
 * terapkan perubahan sebagai SATU transaksi `system/migration` (tidak masuk undo user; klien tetap sinkron).
 * Mengembalikan versi sumber/tujuan; tanpa perubahan bila sudah terkini.
 */
export function migrateYDoc(doc: Y.Doc): { fromVersion: number; toVersion: number; applied: number[] } {
  const version = doc.getMap<unknown>(YDOC_KEYS.meta).get("schemaVersion");
  if (version === CURRENT_SCHEMA_VERSION) return { fromVersion: version, toVersion: version, applied: [] };
  const result = migrateDocument(yDocToJson(doc));
  const parsed = SiteDocumentSchema.safeParse(result.document);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new MigrationError(
      "INVALID_DOCUMENT",
      `Hasil migrasi v${result.fromVersion} tidak valid di ${issue?.path.join(".")}: ${issue?.message}`,
    );
  }
  restoreDocument(doc, parsed.data, systemOrigin("migration"));
  return { fromVersion: result.fromVersion, toVersion: result.toVersion, applied: result.applied };
}
