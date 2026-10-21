import {
  type AcceptConsentsBody,
  AssetSummarySchema,
  ConsentStatusSchema,
  type CreateLibraryComponentBody,
  CreateLibraryComponentResponseSchema,
  type CreateSiteBody,
  dataEnvelope,
  LibraryCategorySchema,
  LibraryComponentListItemSchema,
  LibraryComponentUsageSchema,
  LibraryDraftDefinitionSchema,
  LibraryEditorSessionSchema,
  LibraryPublishedDefinitionSchema,
  type ListSitesQuery,
  listEnvelope,
  type PresignUploadRequest,
  PresignUploadResponseSchema,
  ProfileSchema,
  RealtimeTokenResponseSchema,
  type SaveLibraryDraftBody,
  SessionInfoSchema,
  SiteSchema,
  type UpdateProfileBody,
  type UpdateSiteBody,
  WorkspaceListItemSchema,
  WorkspaceMeSchema,
} from "@platform/shared/contracts";
import { z } from "zod";
import type { ApiClient } from "./client";

// Fungsi endpoint Platform API bertipe dari kontrak (`@platform/shared/contracts`). Path relatif terhadap baseUrl
// (`/api` di browser → web meneruskan ke api tanpa prefix `/api`). Ditambah bersama endpoint baru.

const unwrap = <T>(envelope: { data: T }) => envelope.data;

export function createPlatformApi(client: ApiClient) {
  return {
    workspaces: {
      /** Workspace aktif tempat user menjadi anggota (switcher dashboard), personal dulu. */
      list: () =>
        client.request("GET", "/v1/workspaces", { schema: listEnvelope(WorkspaceListItemSchema) }).then(unwrap),
      /** Role & izin user di workspace (ACC-033). */
      me: (workspaceId: string) =>
        client
          .request("GET", `/v1/workspaces/${workspaceId}/me`, { schema: dataEnvelope(WorkspaceMeSchema) })
          .then(unwrap),
    },
    sites: {
      list: async (workspaceId: string, query: Partial<ListSitesQuery> = {}) => {
        const page = await client.request("GET", `/v1/workspaces/${workspaceId}/sites`, {
          query,
          schema: listEnvelope(SiteSchema),
        });
        return { items: page.data, nextCursor: page.meta.nextCursor };
      },
      create: (workspaceId: string, body: CreateSiteBody) =>
        client
          .request("POST", `/v1/workspaces/${workspaceId}/sites`, { body, schema: dataEnvelope(SiteSchema) })
          .then(unwrap),
      get: (siteId: string) =>
        client.request("GET", `/v1/sites/${siteId}`, { schema: dataEnvelope(SiteSchema) }).then(unwrap),
      rename: (siteId: string, body: UpdateSiteBody) =>
        client.request("PATCH", `/v1/sites/${siteId}`, { body, schema: dataEnvelope(SiteSchema) }).then(unwrap),
      remove: (siteId: string) => client.request("DELETE", `/v1/sites/${siteId}`),
    },
    assets: {
      // Upload aset (ARCHITECTURE §9.9): presign → PUT langsung ke storage → complete (antre image-processing).
      presign: (siteId: string, body: PresignUploadRequest) =>
        client
          .request("POST", `/v1/sites/${siteId}/assets`, { body, schema: dataEnvelope(PresignUploadResponseSchema) })
          .then(unwrap),
      complete: (siteId: string, assetId: string) =>
        client
          .request("POST", `/v1/sites/${siteId}/assets/${assetId}/complete`, {
            schema: dataEnvelope(AssetSummarySchema),
          })
          .then(unwrap),
      get: (siteId: string, assetId: string) =>
        client
          .request("GET", `/v1/sites/${siteId}/assets/${assetId}`, { schema: dataEnvelope(AssetSummarySchema) })
          .then(unwrap),
      // Pustaka media (ED-161): daftar aset situs, opsional difilter nama file.
      list: (siteId: string, query: { search?: string } = {}) =>
        client
          .request("GET", `/v1/sites/${siteId}/assets`, { query, schema: dataEnvelope(z.array(AssetSummarySchema)) })
          .then(unwrap),
      remove: (siteId: string, assetId: string) => client.request("DELETE", `/v1/sites/${siteId}/assets/${assetId}`),
    },
    account: {
      profile: () => client.request("GET", "/v1/account/profile", { schema: dataEnvelope(ProfileSchema) }).then(unwrap),
      updateProfile: (body: UpdateProfileBody) =>
        client.request("PATCH", "/v1/account/profile", { body, schema: dataEnvelope(ProfileSchema) }).then(unwrap),
      consents: () =>
        client.request("GET", "/v1/account/consents", { schema: dataEnvelope(ConsentStatusSchema) }).then(unwrap),
      acceptConsents: (body: AcceptConsentsBody) =>
        client
          .request("POST", "/v1/account/consents", { body, schema: dataEnvelope(ConsentStatusSchema) })
          .then(unwrap),
      sessions: () =>
        client
          .request("GET", "/v1/account/sessions", { schema: dataEnvelope(z.array(SessionInfoSchema)) })
          .then(unwrap),
      revokeSession: (sessionId: string) => client.request("DELETE", `/v1/account/sessions/${sessionId}`),
      revokeOtherSessions: () =>
        client
          .request("POST", "/v1/account/sessions/revoke-others", {
            schema: dataEnvelope(z.object({ revoked: z.number().int().nonnegative() })),
          })
          .then(unwrap),
    },
    realtime: {
      /** Token koneksi Hocuspocus 5 menit untuk satu dokumen (ARCHITECTURE §7.3). */
      token: (docId: string) =>
        client
          .request("POST", "/v1/realtime/token", { body: { docId }, schema: dataEnvelope(RealtimeTokenResponseSchema) })
          .then(unwrap),
    },
    library: {
      /** Kategori library (CMP-150) untuk picker create-from-selection. */
      categories: () =>
        client
          .request("GET", "/v1/admin/library/categories", { schema: dataEnvelope(z.array(LibraryCategorySchema)) })
          .then(unwrap),
      /** Buat component (create-from-selection, CMP-011) → { id (UUID), publicId (cmp_) }. */
      createComponent: (body: CreateLibraryComponentBody) =>
        client
          .request("POST", "/v1/admin/library/components", {
            body,
            schema: dataEnvelope(CreateLibraryComponentResponseSchema),
          })
          .then(unwrap),
      /** Pemakaian per versi/docState (CMP-012/CMP-159) untuk tab Usage panel Mode Admin. */
      usage: (componentId: string) =>
        client
          .request("GET", `/v1/admin/library/components/${componentId}/usage`, {
            schema: dataEnvelope(z.array(LibraryComponentUsageSchema)),
          })
          .then(unwrap),
      /** Simpan metadata draft (CMP-013) — PUT draft, 204. Definisi node diedit lewat realtime, bukan di sini. */
      saveDraft: (componentId: string, body: SaveLibraryDraftBody) =>
        client.request("PUT", `/v1/admin/library/components/${componentId}/draft`, { body }),
      /** Sesi editor Mode Admin (CMP-010): metadata component + kapabilitas user. Non-staf → 404. */
      editorSession: (componentId: string) =>
        client
          .request("GET", `/v1/admin/library/components/${componentId}`, {
            schema: dataEnvelope(LibraryEditorSessionSchema),
          })
          .then(unwrap),
      /** Token realtime 5 menit untuk draft Y.Doc component (D3). */
      realtimeToken: (componentId: string) =>
        client
          .request("POST", `/v1/admin/library/components/${componentId}/realtime-token`, {
            schema: dataEnvelope(RealtimeTokenResponseSchema),
          })
          .then(unwrap),
      /** Definisi draft component by public_id (CMP-011) — registry editor me-resolve instance draft (version 0). */
      draftDefinition: (componentId: string) =>
        client
          .request("GET", `/v1/admin/library/component-drafts/${componentId}`, {
            schema: dataEnvelope(LibraryDraftDefinitionSchema),
          })
          .then(unwrap),
      /** Daftar component published utk panel Insert (T3.6.1) — filter kategori (slug) & pencarian nama. */
      listComponents: (query: { category?: string; search?: string } = {}) =>
        client
          .request("GET", "/v1/library/components", {
            query,
            schema: dataEnvelope(z.array(LibraryComponentListItemSchema)),
          })
          .then(unwrap),
      /** Definisi versi published (CMP-158) — editor me-resolve instance versi published (immutable, cacheable). */
      publishedDefinition: (componentId: string, version: number) =>
        client
          .request("GET", `/v1/library/components/${componentId}/versions/${version}`, {
            schema: dataEnvelope(LibraryPublishedDefinitionSchema),
          })
          .then(unwrap),
    },
  };
}

export type PlatformApi = ReturnType<typeof createPlatformApi>;
