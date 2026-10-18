import type { JsonRecord } from "./index";

// DM-012: v4 → v5. v5 menambah tipe node `group` — perubahan ADITIF: dokumen v4 (tanpa node group) sudah valid di v5
// tanpa transformasi. Migrasi = identitas.
export function v4ToV5(doc: JsonRecord): JsonRecord {
  return doc;
}
