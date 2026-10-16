// @platform/sdk/react: integrasi TanStack Query (peer dependency `react` & `@tanstack/react-query`).
export {
  PlatformApiProvider,
  useConsents,
  useCreateSite,
  usePlatformApi,
  useProfile,
  useRemoveSite,
  useRenameSite,
  useRevokeSession,
  useSessions,
  useSite,
  useSites,
  useUpdateProfile,
  useWorkspaceMe,
  useWorkspaces,
} from "./hooks";
export {
  createMutations,
  createQueries,
  type PlatformMutations,
  type PlatformQueries,
  queryKeys,
} from "./queries";
