import { and, type Db, eq, schema } from "@platform/db";

// Akses tabel untuk processor thumbnails. Worker = sistem (tanpa TenantContext): library = global (`owner_type
// platform`), job hanya dibuat alur publish/admin tepercaya.

const { componentVersions, componentVersionThumbnails } = schema;

export interface PublishedComponentVersion {
  id: string;
  definition: Record<string, unknown>;
}

/** Versi component published (immutable). Null jika tak ada / belum published → job dilewati (idempoten). */
export async function findPublishedComponentVersion(
  db: Db,
  componentVersionId: string,
): Promise<PublishedComponentVersion | null> {
  const [row] = await db
    .select({
      id: componentVersions.id,
      status: componentVersions.status,
      definition: componentVersions.definition,
    })
    .from(componentVersions)
    .where(eq(componentVersions.id, componentVersionId))
    .limit(1);
  if (row?.status !== "published") return null;
  return { id: row.id, definition: row.definition };
}

export type ThumbnailBreakpoint = "base" | "tablet" | "mobile";

export interface ThumbnailRef {
  componentVersionId: string;
  breakpoint: ThumbnailBreakpoint;
  assetKey: string;
  width: number;
  height: number;
}

/** Simpan/segarkan ref thumbnail per breakpoint (idempoten: re-generate meng-upsert). */
export async function upsertThumbnail(db: Db, ref: ThumbnailRef): Promise<void> {
  await db
    .insert(componentVersionThumbnails)
    .values(ref)
    .onConflictDoUpdate({
      target: [componentVersionThumbnails.componentVersionId, componentVersionThumbnails.breakpoint],
      set: { assetKey: ref.assetKey, width: ref.width, height: ref.height, updatedAt: new Date() },
    });
}

export async function listThumbnails(db: Db, componentVersionId: string): Promise<ThumbnailRef[]> {
  const rows = await db
    .select({
      componentVersionId: componentVersionThumbnails.componentVersionId,
      breakpoint: componentVersionThumbnails.breakpoint,
      assetKey: componentVersionThumbnails.assetKey,
      width: componentVersionThumbnails.width,
      height: componentVersionThumbnails.height,
    })
    .from(componentVersionThumbnails)
    .where(and(eq(componentVersionThumbnails.componentVersionId, componentVersionId)));
  return rows;
}
