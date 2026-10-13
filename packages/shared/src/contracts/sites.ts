import { z } from "zod";
import { UuidV7Schema } from "../ids";

// DTO situs (tabel `sites`, ARCHITECTURE §6.3). Kerangka M1; field ditambah seiring fitur (tema, domain, …).
// Bahasa, SEO, dan favicon ada di dokumen (`settings`), bukan di sini (spec 01 DM-078).

export const SiteStatusSchema = z.enum(["draft", "published", "suspended", "archived"]);

export const SiteSchema = z.object({
  id: UuidV7Schema,
  workspaceId: UuidV7Schema,
  name: z.string().min(1).max(80),
  status: SiteStatusSchema,
  documentId: UuidV7Schema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateSiteBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const UpdateSiteBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export type SiteStatus = z.infer<typeof SiteStatusSchema>;
export type Site = z.infer<typeof SiteSchema>;
export type CreateSiteBody = z.infer<typeof CreateSiteBodySchema>;
export type UpdateSiteBody = z.infer<typeof UpdateSiteBodySchema>;
