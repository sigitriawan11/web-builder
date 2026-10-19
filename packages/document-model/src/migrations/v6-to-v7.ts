import type { JsonRecord } from "./index";

// DM-018/DM-019 (M3 Epic 3.1): v6 → v7. v7 menambah tipe node `instance` ke dokumen site (+ slot hanya di
// ComponentDefinition). Perubahan ADITIF: dokumen v6 tidak punya node instance/slot → sudah valid di v7 tanpa
// transformasi. Migrasi = identitas.
export function v6ToV7(doc: JsonRecord): JsonRecord {
  return doc;
}
