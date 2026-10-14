import { z } from "zod";
import { UuidV7Schema } from "../ids";

// Metadata dokumen (tabel `documents`, ARCHITECTURE §6.3). Isi dokumen tidak lewat REST: Y.Doc disinkronkan
// lewat Hocuspocus (ARCHITECTURE §7), sehingga kontrak ini hanya metadata.

export const DocumentKindSchema = z.enum(["site", "component", "template"]);

export const DocumentMetaSchema = z.object({
  id: UuidV7Schema,
  workspaceId: UuidV7Schema,
  siteId: UuidV7Schema.nullable(), // null untuk dokumen library
  kind: DocumentKindSchema,
  schemaVersion: z.number().int().positive(),
  lastSeq: z.number().int().nonnegative(),
  sizeBytes: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
});

export type DocumentKind = z.infer<typeof DocumentKindSchema>;
export type DocumentMeta = z.infer<typeof DocumentMetaSchema>;

// `GET /internal/v1/documents/:id/state` (ARCHITECTURE §5.5): body = state Yjs biner (application/octet-stream),
// metadata di header. Sumber `db` = snapshot + update setelahnya; `memory` = dokumen yang sedang dibuka realtime.
export const DOCUMENT_STATE_HEADERS = {
  seq: "x-document-seq",
  schemaVersion: "x-document-schema-version",
  source: "x-document-state-source",
} as const;
export const DocumentStateSourceSchema = z.enum(["db", "memory"]);
export type DocumentStateSource = z.infer<typeof DocumentStateSourceSchema>;
