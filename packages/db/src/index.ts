// @platform/db: Drizzle schema & migration (satu-satunya tempat), client, TenantContext, seed, test factories
// (ARCHITECTURE §4.2, §6). Hanya untuk api, worker, realtime — dilarang di editor/web/site-host (§4.3).

// Operator query Drizzle dari SATU salinan drizzle-orm (milik paket ini): app tidak bergantung langsung pada
// drizzle-orm, sehingga tidak ada varian ganda (mis. akibat optional peer dari dependency lain) yang tipenya bentrok.
export {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
export { type CreateDbOptions, createDb, type Db, type DbExecutor, type DbTransaction } from "./client";
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
