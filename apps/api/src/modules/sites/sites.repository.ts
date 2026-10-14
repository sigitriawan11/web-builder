import {
  and,
  asc,
  type DbExecutor,
  desc,
  eq,
  ilike,
  lt,
  ne,
  notDeleted,
  type SiteTenant,
  type SQL,
  schema,
  sql,
  type WorkspaceTenant,
  workspaceWhere,
} from "@platform/db";
import type { SiteDocument } from "@platform/document-model";
import type { ListSitesQuery } from "@platform/shared/contracts";

// SATU-SATUNYA tempat modul sites mengakses tabel (CLAUDE.md, ARCHITECTURE §6.2). Tenant selalu parameter pertama
// dan selalu masuk ke filter; menerima db ATAU transaksi (service yang membuka transaksi).

const { documents, documentSnapshots, sitePages, sites } = schema;

type Tenant = WorkspaceTenant | SiteTenant;
export type SiteRow = typeof sites.$inferSelect;

/**
 * Posisi keyset cursor per urutan. `updated` memakai teks timestamp presisi mikrodetik dari Postgres (Date JS hanya
 * milidetik → halaman bisa melompati/menggandakan baris). `name` memakai lower(name).
 */
export type ListPosition =
  | { sort: "updated"; value: string; id: string }
  | { sort: "name"; value: string; id: string }
  | { sort: "created"; id: string };

export type ListedSite = SiteRow & { cursorValue: string };

const updatedText = sql<string>`to_char(${sites.updatedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const lowerName = sql<string>`lower(${sites.name})`;

/** Escape wildcard LIKE agar pencarian "50%" tidak menjadi pola. */
const likePattern = (query: string) => `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

export async function listSites(
  db: DbExecutor,
  tenant: Tenant,
  query: Pick<ListSitesQuery, "status" | "sort" | "q"> & { limit: number; after?: ListPosition },
): Promise<ListedSite[]> {
  const filters: (SQL | undefined)[] = [workspaceWhere(tenant, sites), notDeleted(sites)];
  if (query.status === "all") filters.push(ne(sites.status, "archived"));
  else filters.push(eq(sites.status, query.status));
  if (query.q) filters.push(ilike(sites.name, likePattern(query.q)));

  const after = query.after;
  if (query.sort === "updated") {
    if (after?.sort === "updated")
      filters.push(sql`(${sites.updatedAt}, ${sites.id}) < (${after.value}::timestamptz, ${after.id}::uuid)`);
    return db
      .select({ ...getSiteColumns(), cursorValue: updatedText })
      .from(sites)
      .where(and(...filters))
      .orderBy(desc(sites.updatedAt), desc(sites.id))
      .limit(query.limit);
  }
  if (query.sort === "name") {
    if (after?.sort === "name") filters.push(sql`(${lowerName}, ${sites.id}) > (${after.value}, ${after.id}::uuid)`);
    return db
      .select({ ...getSiteColumns(), cursorValue: lowerName })
      .from(sites)
      .where(and(...filters))
      .orderBy(asc(lowerName), asc(sites.id))
      .limit(query.limit);
  }
  // `created`: UUIDv7 terurut waktu → id desc = terbaru dibuat.
  if (after?.sort === "created") filters.push(lt(sites.id, after.id));
  return db
    .select({ ...getSiteColumns(), cursorValue: sql<string>`''` })
    .from(sites)
    .where(and(...filters))
    .orderBy(desc(sites.id))
    .limit(query.limit);
}

function getSiteColumns() {
  return {
    id: sites.id,
    workspaceId: sites.workspaceId,
    name: sites.name,
    status: sites.status,
    documentId: sites.documentId,
    createdBy: sites.createdBy,
    createdAt: sites.createdAt,
    updatedAt: sites.updatedAt,
    deletedAt: sites.deletedAt,
  };
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
): Promise<{ site: SiteRow; documentId: string }> {
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
  return { site, documentId: document.id };
}

/**
 * Isi awal dokumen (T1.6.2): snapshot `uptoSeq` 0 (state Yjs + JSON tervalidasi) yang dimuat realtime sebagai titik
 * awal, plus read model `site_pages` dari page dokumen (projections realtime menimpanya kemudian, T1.12.7).
 * WAJIB di transaksi yang sama dengan pembuatan situs.
 */
export async function writeInitialDocument(
  tx: DbExecutor,
  tenant: Tenant,
  input: { siteId: string; documentId: string; document: SiteDocument; state: Uint8Array; createdBy: string | null },
): Promise<void> {
  const [snapshot] = await tx
    .insert(documentSnapshots)
    .values({
      documentId: input.documentId,
      uptoSeq: 0,
      state: input.state,
      json: input.document,
      kind: "auto",
      createdBy: input.createdBy,
    })
    .returning({ id: documentSnapshots.id });
  if (!snapshot) throw new Error("insert snapshot awal gagal");
  await tx
    .update(documents)
    .set({
      lastSnapshotId: snapshot.id,
      sizeBytes: input.state.byteLength,
      schemaVersion: input.document.schemaVersion,
    })
    .where(and(eq(documents.id, input.documentId), eq(documents.workspaceId, tenant.workspaceId)));

  const pages = input.document.pageOrder.flatMap((pageId, sortOrder) => {
    const page = input.document.nodes[pageId];
    if (page?.type !== "page") return [];
    return [
      {
        siteId: input.siteId,
        pageId,
        path: page.props.path,
        title: page.props.title,
        seo: page.props.seo ?? null,
        sortOrder,
        isHome: page.props.isHome === true,
        nodeCount: countNodes(input.document, pageId),
      },
    ];
  });
  if (pages.length > 0) await tx.insert(sitePages).values(pages);
}

/** Jumlah node di bawah page (termasuk page itu). */
function countNodes(document: SiteDocument, pageId: string): number {
  let count = 0;
  const stack = [pageId];
  while (stack.length > 0) {
    const node = document.nodes[stack.pop() ?? ""];
    if (!node) continue;
    count += 1;
    if ("children" in node) stack.push(...node.children);
  }
  return count;
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
