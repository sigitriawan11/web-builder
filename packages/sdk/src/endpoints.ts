import {
  type AcceptConsentsBody,
  ConsentStatusSchema,
  type CreateSiteBody,
  dataEnvelope,
  type ListSitesQuery,
  listEnvelope,
  ProfileSchema,
  RealtimeTokenResponseSchema,
  SessionInfoSchema,
  SiteSchema,
  type UpdateProfileBody,
  type UpdateSiteBody,
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
  };
}

export type PlatformApi = ReturnType<typeof createPlatformApi>;
