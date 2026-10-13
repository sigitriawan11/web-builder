// @platform/db: Drizzle schema & migration (satu-satunya tempat), client, TenantContext, seed, test factories
// (ARCHITECTURE §4.2, §6). Hanya untuk api, worker, realtime — dilarang di editor/web/site-host (§4.3).
export { type CreateDbOptions, createDb, type Db } from "./client";
export { id, identityId, softDelete, timestamps } from "./columns";
export * as schema from "./schema";
export {
  type Actor,
  ActorSchema,
  notDeleted,
  type SiteTenant,
  type SystemTenant,
  siteScope,
  siteWhere,
  systemScope,
  type TenantContext,
  tenantLogFields,
  type WorkspaceTenant,
  workspaceScope,
  workspaceWhere,
} from "./tenant";
