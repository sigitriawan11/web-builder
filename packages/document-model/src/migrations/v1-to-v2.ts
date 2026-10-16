import type { JsonRecord } from "./index";

// DM-071: v1 → v2. v2 menambah tipe node `shape` (DM-016) & `icon` (DM-015) — perubahan aditif: dokumen v1 (tanpa
// node tipe itu) sudah valid di v2 tanpa transformasi. Migrasi = identitas (versi dinaikkan oleh `migrateDocument`).
export function v1ToV2(doc: JsonRecord): JsonRecord {
  return doc;
}
