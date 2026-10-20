import type { JsonRecord } from "./index";

// CMP-011/Option A (M3): v8 → v9. `instance.version` dilonggarkan dari >0 menjadi ≥0 (`0` = rujukan draft terbaru,
// create-from-selection Mode Admin). ADITIF: dokumen v8 (semua instance ber-version >0) sudah valid di v9. Identitas.
export function v8ToV9(doc: JsonRecord): JsonRecord {
  return doc;
}
