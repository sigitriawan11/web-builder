import type { JsonRecord } from "./index";

// DM-040 (M3): v7 → v8. v8 menambah state `focus`/`disabled` ke `style.states` (selain hover/pressed). ADITIF:
// dokumen v7 (hanya hover/pressed) sudah valid di v8 tanpa transformasi. Migrasi = identitas.
export function v7ToV8(doc: JsonRecord): JsonRecord {
  return doc;
}
