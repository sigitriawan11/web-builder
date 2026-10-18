import { PresignUploadRequestSchema } from "@platform/shared/contracts";
import { z } from "zod";

// Zod request modul assets (CLAUDE.md § Struktur modul API). Body presign = kontrak shared (dipakai editor juga).
const SiteParams = z.object({ siteId: z.uuid() });
const AssetParams = z.object({ siteId: z.uuid(), assetId: z.string().regex(/^ast_[0-9a-z]{6,24}$/) });

export const presignRequest = { params: SiteParams, body: PresignUploadRequestSchema };
export const completeRequest = { params: AssetParams };
export const getAssetRequest = { params: AssetParams };
export const listRequest = {
  params: SiteParams,
  query: z.object({ search: z.string().trim().min(1).max(255).optional() }),
};
export const deleteRequest = { params: AssetParams };
export const contentRequest = { params: AssetParams };
