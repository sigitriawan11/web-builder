import type { JsonRecord } from "./index";

// DM-026: v2 → v3. v3 menambah layout `mode: "grid"` (DM-011/DM-026) + `gridColumn`/`gridRow` di flexChild —
// perubahan ADITIF: dokumen v2 (tanpa grid) sudah valid di v3 tanpa transformasi. Migrasi = identitas.
export function v2ToV3(doc: JsonRecord): JsonRecord {
  return doc;
}
