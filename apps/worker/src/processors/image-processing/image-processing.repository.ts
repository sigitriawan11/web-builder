import { type Db, eq, schema, sql } from "@platform/db";

// Akses tabel untuk processor image-processing. Worker = sistem (tanpa TenantContext): aman mengakses per `assetId`
// karena job hanya dibuat API yang sudah ber-scope tenant (ARCHITECTURE §9.5).

const { assets, storageUsage } = schema;
export type AssetRow = typeof assets.$inferSelect;

export async function findAsset(db: Db, assetId: string): Promise<AssetRow | null> {
  const [row] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  return row ?? null;
}

export interface ReadyUpdate {
  width: number;
  height: number;
  blurhash: string;
  sha256: string;
  variants: Record<string, string>;
}

/** Tandai `ready` + metadata hasil proses, dan tambah pemakaian storage workspace (kuota, spec 08). */
export async function markReady(db: Db, asset: AssetRow, update: ReadyUpdate): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(assets)
      .set({
        status: "ready",
        width: update.width,
        height: update.height,
        blurhash: update.blurhash,
        sha256: update.sha256,
        variants: update.variants,
      })
      .where(eq(assets.id, asset.id));
    await tx
      .insert(storageUsage)
      .values({ workspaceId: asset.workspaceId, bytesUsed: asset.sizeBytes })
      .onConflictDoUpdate({
        target: storageUsage.workspaceId,
        set: { bytesUsed: sql`${storageUsage.bytesUsed} + ${asset.sizeBytes}` },
      });
  });
}

export async function markRejected(db: Db, assetId: string): Promise<void> {
  await db.update(assets).set({ status: "rejected" }).where(eq(assets.id, assetId));
}
