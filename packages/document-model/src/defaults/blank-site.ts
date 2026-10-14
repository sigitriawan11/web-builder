import { createId } from "../ids";
import { CURRENT_SCHEMA_VERSION, type SiteDocument, SiteDocumentSchema } from "../schema";
import { emptyDocumentShell } from "./top-level";

// Dokumen awal situs kosong (ACC-051 jalur "blank", DM-004, DM-010): satu page Home di "/" tanpa konten.
// `theme` & `settings` default ditambah bersama schema v1 (Epic 1.8) — dokumen yang sudah dibuat dimigrasi saat
// `schemaVersion` naik.

export interface BlankSiteInput {
  // Judul situs (meta.title) — nama situs saat dibuat.
  title: string;
  // Bahasa website (bahasa UI user); default `id`.
  language?: string;
  // Judul page Home di panel Pages; default "Beranda" (id) / "Home" (lainnya).
  homeTitle?: string;
}

/** Dokumen baru yang SUDAH lolos validasi strict (`SiteDocumentSchema`); ID node dibuat baru tiap panggilan. */
export function createBlankSiteDocument(input: BlankSiteInput): SiteDocument {
  const homeId = createId("pg");
  const language = input.language ?? "id";
  const homeTitle = input.homeTitle ?? (language === "id" ? "Beranda" : "Home");
  return SiteDocumentSchema.parse({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: { title: input.title, createdWith: "blank" },
    ...emptyDocumentShell({ title: input.title, language }),
    pageOrder: [homeId],
    nodes: {
      [homeId]: {
        id: homeId,
        type: "page",
        parentId: null,
        name: homeTitle,
        visible: true,
        locked: false,
        style: { base: {} },
        children: [],
        props: { path: "/", title: homeTitle, isHome: true },
      },
    },
  });
}
