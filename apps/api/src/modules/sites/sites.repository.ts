import {
  and,
  type DbExecutor,
  desc,
  eq,
  lt,
  notDeleted,
  type SiteTenant,
  schema,
  type WorkspaceTenant,
  workspaceWhere,
} from "@platform/db";

// SATU-SATUNYA tempat modul sites mengakses tabel (CLAUDE.md, ARCHITECTURE §6.2). Tenant selalu parameter pertama
// dan selalu masuk ke filter; menerima db ATAU transaksi (service yang membuka transaksi).

const { documents, sites } = schema;

type Tenant = WorkspaceTenant | SiteTenant;
export type SiteRow = typeof sites.$inferSelect;

export async function listSites(
  db: DbExecutor,
  tenant: Tenant,
  page: { limit: number; beforeId?: string },
): Promise<SiteRow[]> {
  return (
    db
      .select()
      .from(sites)
      .where(
        and(workspaceWhere(tenant, sites), notDeleted(sites), page.beforeId ? lt(sites.id, page.beforeId) : undefined),
      )
      // UUIDv7 terurut waktu: id desc = terbaru dulu, dan stabil untuk cursor.
      .orderBy(desc(sites.id))
      .limit(page.limit)
  );
}

export async function findSite(db: DbExecutor, tenant: Tenant, siteId: string): Promise<SiteRow | undefined> {
  const [row] = await db
    .select()
    .from(sites)
    .where(and(workspaceWhere(tenant, sites), eq(sites.id, siteId), notDeleted(sites)));
  return row;
}

/** Situs + dokumennya; WAJIB dipanggil di dalam transaksi (FK dua arah, ARCHITECTURE §6.3). */
export async function insertSiteWithDocument(
  tx: DbExecutor,
  tenant: Tenant,
  input: { name: string; schemaVersion: number },
): Promise<SiteRow> {
  const [document] = await tx
    .insert(documents)
    .values({ workspaceId: tenant.workspaceId, kind: "site", schemaVersion: input.schemaVersion })
    .returning({ id: documents.id });
  if (!document) throw new Error("insert dokumen gagal");
  const [site] = await tx
    .insert(sites)
    .values({
      workspaceId: tenant.workspaceId,
      name: input.name,
      documentId: document.id,
      // Staf tidak membuat situs atas namanya sendiri; AI = user yang memulai run.
      createdBy: tenant.actor.type === "staff" ? null : tenant.actor.userId,
    })
    .returning();
  if (!site) throw new Error("insert situs gagal");
  await tx.update(documents).set({ siteId: site.id }).where(eq(documents.id, document.id));
  return site;
}

export async function updateSiteName(
  db: DbExecutor,
  tenant: Tenant,
  siteId: string,
  name: string,
): Promise<SiteRow | undefined> {
  const [row] = await db
    .update(sites)
    .set({ name })
    .where(and(workspaceWhere(tenant, sites), eq(sites.id, siteId), notDeleted(sites)))
    .returning();
  return row;
}

export async function softDeleteSite(db: DbExecutor, tenant: Tenant, siteId: string): Promise<boolean> {
  const rows = await db
    .update(sites)
    .set({ deletedAt: new Date() })
    .where(and(workspaceWhere(tenant, sites), eq(sites.id, siteId), notDeleted(sites)))
    .returning({ id: sites.id });
  return rows.length > 0;
}
