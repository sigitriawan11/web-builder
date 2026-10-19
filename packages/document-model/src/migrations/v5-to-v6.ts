import type { JsonRecord } from "./index";

// DM-015/ED-163: v5 → v6. v6 memperluas `icon.set` dari `"lucide"` saja menjadi `"lucide" | "brand"` — perubahan
// ADITIF: dokumen v5 (semua icon set "lucide") sudah valid di v6 tanpa transformasi. Migrasi = identitas.
export function v5ToV6(doc: JsonRecord): JsonRecord {
  return doc;
}
