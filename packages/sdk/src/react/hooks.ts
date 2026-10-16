import type { ListSitesQuery } from "@platform/shared/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, createElement, type ReactNode, useContext, useMemo } from "react";
import type { PlatformApi } from "../endpoints";
import { createMutations, createQueries } from "./queries";

// Hook TanStack Query tipis di atas `createQueries`/`createMutations` (web Client Component & editor).
// QueryClientProvider dipasang aplikasi; provider ini hanya menyediakan instance PlatformApi.

const PlatformApiContext = createContext<PlatformApi | null>(null);

export function PlatformApiProvider(props: { api: PlatformApi; children: ReactNode }) {
  return createElement(PlatformApiContext.Provider, { value: props.api }, props.children);
}

export function usePlatformApi(): PlatformApi {
  const api = useContext(PlatformApiContext);
  if (!api) throw new Error("usePlatformApi dipakai di luar <PlatformApiProvider>");
  return api;
}

function useQueries() {
  const api = usePlatformApi();
  return useMemo(() => createQueries(api), [api]);
}

function useMutations() {
  const api = usePlatformApi();
  const queryClient = useQueryClient();
  return useMemo(() => createMutations(api, queryClient), [api, queryClient]);
}

export const useWorkspaces = () => useQuery(useQueries().workspaces());
export const useWorkspaceMe = (workspaceId: string) => useQuery(useQueries().workspaceMe(workspaceId));
export const useSites = (workspaceId: string, query: Partial<ListSitesQuery> = {}) =>
  useQuery(useQueries().sites(workspaceId, query));
export const useSite = (siteId: string) => useQuery(useQueries().site(siteId));
export const useProfile = () => useQuery(useQueries().profile());
export const useConsents = () => useQuery(useQueries().consents());
export const useSessions = () => useQuery(useQueries().sessions());

export const useCreateSite = () => useMutation({ mutationFn: useMutations().createSite });
export const useRenameSite = () => useMutation({ mutationFn: useMutations().renameSite });
export const useRemoveSite = () => useMutation({ mutationFn: useMutations().removeSite });
export const useUpdateProfile = () => useMutation({ mutationFn: useMutations().updateProfile });
export const useRevokeSession = () => useMutation({ mutationFn: useMutations().revokeSession });
