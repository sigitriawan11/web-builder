import type { ListSitesQuery } from "@platform/shared/contracts";
import { type QueryClient, queryOptions } from "@tanstack/react-query";
import type { PlatformApi } from "../endpoints";

// Query key & options TanStack Query (ARCHITECTURE §5.1). Factory murni (tanpa React) → bisa dipakai prefetch di
// Server Component dan dites dengan QueryClient biasa. Key hierarkis: invalidasi `sites` membersihkan list & detail.

export const queryKeys = {
  workspaces: ["workspaces", "list"] as const,
  workspaceMe: (workspaceId: string) => ["workspaces", workspaceId, "me"] as const,
  sites: {
    all: ["sites"] as const,
    list: (workspaceId: string, query: Partial<ListSitesQuery> = {}) => ["sites", "list", workspaceId, query] as const,
    detail: (siteId: string) => ["sites", "detail", siteId] as const,
  },
  account: {
    all: ["account"] as const,
    profile: ["account", "profile"] as const,
    consents: ["account", "consents"] as const,
    sessions: ["account", "sessions"] as const,
  },
};

export function createQueries(api: PlatformApi) {
  return {
    workspaces: () => queryOptions({ queryKey: queryKeys.workspaces, queryFn: () => api.workspaces.list() }),
    workspaceMe: (workspaceId: string) =>
      queryOptions({ queryKey: queryKeys.workspaceMe(workspaceId), queryFn: () => api.workspaces.me(workspaceId) }),
    sites: (workspaceId: string, query: Partial<ListSitesQuery> = {}) =>
      queryOptions({
        queryKey: queryKeys.sites.list(workspaceId, query),
        queryFn: () => api.sites.list(workspaceId, query),
      }),
    site: (siteId: string) =>
      queryOptions({ queryKey: queryKeys.sites.detail(siteId), queryFn: () => api.sites.get(siteId) }),
    profile: () => queryOptions({ queryKey: queryKeys.account.profile, queryFn: () => api.account.profile() }),
    consents: () => queryOptions({ queryKey: queryKeys.account.consents, queryFn: () => api.account.consents() }),
    sessions: () => queryOptions({ queryKey: queryKeys.account.sessions, queryFn: () => api.account.sessions() }),
  };
}

export type PlatformQueries = ReturnType<typeof createQueries>;

/**
 * Mutasi + invalidasi cache yang relevan. Dipisah dari hook agar logikanya bisa dites tanpa render React.
 */
export function createMutations(api: PlatformApi, queryClient: QueryClient) {
  const invalidateSites = () => queryClient.invalidateQueries({ queryKey: queryKeys.sites.all });
  return {
    createSite: async (input: { workspaceId: string; name: string }) => {
      const site = await api.sites.create(input.workspaceId, { name: input.name });
      await invalidateSites();
      return site;
    },
    renameSite: async (input: { siteId: string; name: string }) => {
      const site = await api.sites.rename(input.siteId, { name: input.name });
      queryClient.setQueryData(queryKeys.sites.detail(site.id), site);
      await invalidateSites();
      return site;
    },
    removeSite: async (siteId: string) => {
      await api.sites.remove(siteId);
      queryClient.removeQueries({ queryKey: queryKeys.sites.detail(siteId) });
      await invalidateSites();
    },
    updateProfile: async (body: Parameters<PlatformApi["account"]["updateProfile"]>[0]) => {
      const profile = await api.account.updateProfile(body);
      queryClient.setQueryData(queryKeys.account.profile, profile);
      return profile;
    },
    revokeSession: async (sessionId: string) => {
      await api.account.revokeSession(sessionId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.account.sessions });
    },
  };
}

export type PlatformMutations = ReturnType<typeof createMutations>;
