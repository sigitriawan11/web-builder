import type { JsonRecord } from "./index";

// DM-029: v3 → v4. v4 menambah fill `linearGradient` & `radialGradient` — perubahan ADITIF: dokumen v3 (tanpa
// gradient) sudah valid di v4 tanpa transformasi. Migrasi = identitas.
export function v3ToV4(doc: JsonRecord): JsonRecord {
  return doc;
}
