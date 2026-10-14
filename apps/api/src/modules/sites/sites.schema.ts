import { CreateSiteBodySchema, ListSitesQuerySchema, UpdateSiteBodySchema } from "@platform/shared/contracts";
import { z } from "zod";

// Zod request modul sites (CLAUDE.md § Struktur modul API). Bentuk body/response = `@platform/shared/contracts`
// (dipakai juga sdk); di sini hanya params & penggabungan per endpoint.

const WorkspaceParams = z.object({ workspaceId: z.uuid() });
const SiteParams = WorkspaceParams.extend({ siteId: z.uuid() });

export const listSitesRequest = { params: WorkspaceParams, query: ListSitesQuerySchema };
export const createSiteRequest = { params: WorkspaceParams, body: CreateSiteBodySchema };
export const getSiteRequest = { params: SiteParams };
export const updateSiteRequest = { params: SiteParams, body: UpdateSiteBodySchema };
export const deleteSiteRequest = { params: SiteParams };
