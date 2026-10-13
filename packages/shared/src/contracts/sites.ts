import { z } from "zod";
import { UuidV7Schema } from "../ids";

// DTO situs (tabel `sites`, ARCHITECTURE §6.3). Kerangka M1; field ditambah seiring fitur (tema, domain, …).

export const SiteStatusSchema = z.enum(["draft", "published", "suspended", "archived"]);

export const SiteSchema = z.object({
  id: UuidV7Schema,
  workspaceId: UuidV7Schema,
  name: z.string().min(1).max(80),
  status: SiteStatusSchema,
  documentId: UuidV7Schema,
  defaultLocale: z.enum(["id", "en"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const CreateSiteBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export type SiteStatus = z.infer<typeof SiteStatusSchema>;
export type Site = z.infer<typeof SiteSchema>;
export type CreateSiteBody = z.infer<typeof CreateSiteBodySchema>;
