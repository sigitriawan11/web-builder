import { defaultTheme } from "../defaults/theme";
import { defaultSiteSettings } from "../defaults/top-level";

// v0 = format prototipe M0 (sebelum Epic 1.8): hanya meta, assets, pageOrder, nodes.
// v1 menambah `settings` (DM-005), `theme` (DM-041), `componentDeps` (DM-004). Node v0 sudah kompatibel.

type JsonRecord = Record<string, unknown>;

// Dari Y.Doc, root kosong menjadi `{}` (bukan tidak ada) — perlakukan sama dengan tidak ada.
const present = (value: unknown): boolean =>
  typeof value === "object" && value !== null && Object.keys(value).length > 0;

export function v0ToV1(doc: JsonRecord): JsonRecord {
  const meta = (doc.meta ?? {}) as { title?: unknown };
  const title = typeof meta.title === "string" && meta.title.length > 0 ? meta.title : "Situs";
  return {
    ...doc,
    // Bahasa default pasar utama; dokumen v0 tidak menyimpan bahasa.
    settings: present(doc.settings) ? doc.settings : defaultSiteSettings({ title, language: "id" }),
    // defaultTheme: rujukan token prototipe (`space.6`, `color.background`, …) memakai nama token DM-041.
    theme: present(doc.theme) ? doc.theme : defaultTheme(),
    componentDeps: present(doc.componentDeps) ? doc.componentDeps : {},
  };
}
