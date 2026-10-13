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
