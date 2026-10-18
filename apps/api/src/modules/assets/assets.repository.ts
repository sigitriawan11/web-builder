import { and, type DbExecutor, desc, eq, notDeleted, type SiteTenant, schema, siteWhere, sql } from "@platform/db";

// SATU-SATUNYA tempat modul assets mengakses tabel (CLAUDE.md, ARCHITECTURE §6.2). Tenant selalu parameter pertama &
// selalu masuk filter (isolasi: user A tak bisa menyentuh aset situs B).

const { assets } = schema;
export type AssetRow = typeof assets.$inferSelect;

export interface NewPendingAsset {
  id: string;
  kind: AssetRow["kind"];
  storageKey: string;
  fileName: string | null;
  mime: string;
  sizeBytes: number;
  uploadedBy: string;
}

/** Buat record aset status `pending` (sebelum upload). Di-scope ke workspace+site tenant. */
export async function insertPending(tenant: SiteTenant, db: DbExecutor, input: NewPendingAsset): Promise<void> {
  await db.insert(assets).values({
    id: input.id,
    workspaceId: tenant.workspaceId,
    siteId: tenant.siteId,
    kind: input.kind,
    storageKey: input.storageKey,
    fileName: input.fileName,
    mime: input.mime,
    sizeBytes: input.sizeBytes,
    uploadedBy: input.uploadedBy,
    status: "pending",
  });
}

/** Aset milik tenant ini (null bila bukan milik situs/workspace tenant atau sudah dihapus). */
export async function findScoped(tenant: SiteTenant, db: DbExecutor, assetId: string): Promise<AssetRow | null> {
  const [row] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), siteWhere(tenant, assets), notDeleted(assets)))
    .limit(1);
  return row ?? null;
}

export interface ListOptions {
  /** Filter prefix nama file (ILIKE) — pencarian pustaka media (ED-161). */
  search?: string;
  limit: number;
}

/** Aset situs tenant (terbaru dulu), opsional difilter nama. Selalu ter-scope + belum dihapus. */
export async function listScoped(tenant: SiteTenant, db: DbExecutor, options: ListOptions): Promise<AssetRow[]> {
  const filters = [siteWhere(tenant, assets), notDeleted(assets)];
  if (options.search) filters.push(sql`${assets.fileName} ilike ${`%${options.search}%`}`);
  return db
    .select()
    .from(assets)
    .where(and(...filters))
    .orderBy(desc(assets.createdAt))
    .limit(options.limit);
}

/** Soft delete aset tenant. Objek storage di-GC terpisah (purge). Return false bila bukan milik tenant. */
export async function softDelete(tenant: SiteTenant, db: DbExecutor, assetId: string): Promise<boolean> {
  const result = await db
    .update(assets)
    .set({ deletedAt: sql`now()` })
    .where(and(eq(assets.id, assetId), siteWhere(tenant, assets), notDeleted(assets)))
    .returning({ id: assets.id });
  return result.length > 0;
}

export async function setStatus(
  tenant: SiteTenant,
  db: DbExecutor,
  assetId: string,
  status: AssetRow["status"],
): Promise<void> {
  await db
    .update(assets)
    .set({ status })
    .where(and(eq(assets.id, assetId), siteWhere(tenant, assets)));
}
