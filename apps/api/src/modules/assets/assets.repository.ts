import { and, type DbExecutor, eq, notDeleted, type SiteTenant, schema, siteWhere } from "@platform/db";

// SATU-SATUNYA tempat modul assets mengakses tabel (CLAUDE.md, ARCHITECTURE §6.2). Tenant selalu parameter pertama &
// selalu masuk filter (isolasi: user A tak bisa menyentuh aset situs B).

const { assets } = schema;
export type AssetRow = typeof assets.$inferSelect;

export interface NewPendingAsset {
  id: string;
  kind: AssetRow["kind"];
  storageKey: string;
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
