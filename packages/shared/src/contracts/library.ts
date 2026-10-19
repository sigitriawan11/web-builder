import { z } from "zod";
import { UuidV7Schema } from "../ids";

// DTO library platform untuk editor Mode Admin (CMP-010/CMP-158). `componentId` dokumen = `cmp_…` (public_id);
// `id` = UUID internal. Role staf menentukan kapabilitas (baca vs edit draft vs publish).

export const LocalizedTextSchema = z.object({ id: z.string(), en: z.string() });

export const ComponentKindSchema = z.enum(["element", "block", "section", "page", "layout"]);
export const LibraryStatusSchema = z.enum(["draft", "in_review", "published", "deprecated", "archived"]);
export const StaffRoleSchema = z.enum(["super_admin", "staff", "library_admin", "designer"]);

export const LibraryComponentSummarySchema = z.object({
  id: UuidV7Schema,
  // ID yang dirujuk dokumen (DM-018).
  publicId: z.string().regex(/^cmp_[0-9a-z]{6,24}$/),
  kind: ComponentKindSchema,
  name: z.string(),
  displayName: LocalizedTextSchema,
  description: LocalizedTextSchema,
  status: LibraryStatusSchema,
  latestVersion: z.string().nullable(),
  hasDraft: z.boolean(),
  // Dokumen Yjs draft (kind=component) yang dibuka editor Mode Admin; null bila belum ada draft.
  draftDocumentId: UuidV7Schema.nullable(),
});

// Kapabilitas user (dari `users.staff_role`) terhadap library (CMP-010 §tabel role).
export const LibraryCapabilitiesSchema = z.object({
  role: StaffRoleSchema,
  canEditDraft: z.boolean(),
  canPublish: z.boolean(),
});

// Bootstrap sesi editor Mode Admin: metadata component + kapabilitas user. Non-staf → 404 (permukaan tak bocor).
export const LibraryEditorSessionSchema = z.object({
  component: LibraryComponentSummarySchema,
  capabilities: LibraryCapabilitiesSchema,
});

export type ComponentKind = z.infer<typeof ComponentKindSchema>;
export type LibraryStatus = z.infer<typeof LibraryStatusSchema>;
export type StaffRole = z.infer<typeof StaffRoleSchema>;
export type LibraryComponentSummary = z.infer<typeof LibraryComponentSummarySchema>;
export type LibraryCapabilities = z.infer<typeof LibraryCapabilitiesSchema>;
export type LibraryEditorSession = z.infer<typeof LibraryEditorSessionSchema>;
