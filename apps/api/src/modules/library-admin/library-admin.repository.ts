import { and, asc, type DbExecutor, desc, eq, gt, ilike, inArray, schema, sql } from "@platform/db";
import { mergeDocumentUpdates } from "@platform/document-model";

// SATU-SATUNYA tempat modul admin library menyentuh tabel. Library platform = global (owner_type='platform');
// tanpa scope tenant. `exec` bisa `Db` atau transaksi (publish berjalan dalam satu transaksi, CMP-159 AC-2).
const {
  components,
  componentVersions,
  documents,
  documentSnapshots,
  documentUpdates,
  libraryCategories,
  siteComponentUsage,
  themes,
} = schema;

export interface CategoryRow {
  id: string;
  slug: string;
  type: (typeof schema.libraryCategoryTypeEnum.enumValues)[number];
  name: { id: string; en: string };
}

/** Kategori library (CMP-150) untuk picker create-from-selection. Scope component/both, urut sortOrder. */
export async function listComponentCategories(exec: DbExecutor): Promise<CategoryRow[]> {
  return exec
    .select({
      id: libraryCategories.id,
      slug: libraryCategories.slug,
      type: libraryCategories.type,
      name: libraryCategories.name,
    })
    .from(libraryCategories)
    .where(inArray(libraryCategories.scope, ["component", "both"]))
    .orderBy(asc(libraryCategories.sortOrder));
}

export interface AdminListFilter {
  status?: (typeof schema.libraryStatusEnum.enumValues)[number] | undefined;
  category?: string | undefined;
  search?: string | undefined;
  limit: number;
  offset: number;
}

export interface AdminComponentRow {
  id: string;
  publicId: string;
  name: string;
  displayName: { id: string; en: string };
  kind: (typeof components.kind.enumValues)[number];
  categorySlug: string;
  status: (typeof schema.libraryStatusEnum.enumValues)[number];
  latestVersion: string | null;
  usageSiteCount: number;
  draftDocumentId: string | null;
  updatedAt: Date;
}

/** Daftar component admin (ACC-208/T3.8.1): SEMUA status, platform-owned. Filter status/kategori/pencarian + paginasi. */
export async function listAdminComponents(
  exec: DbExecutor,
  filter: AdminListFilter,
): Promise<{ items: AdminComponentRow[]; total: number }> {
  const conditions = [eq(components.ownerType, "platform")];
  if (filter.status) conditions.push(eq(components.status, filter.status));
  if (filter.category) conditions.push(eq(libraryCategories.slug, filter.category));
  if (filter.search) conditions.push(ilike(components.name, `%${filter.search}%`));
  const where = and(...conditions);

  const items = await exec
    .select({
      id: components.id,
      publicId: components.publicId,
      name: components.name,
      displayName: components.displayName,
      kind: components.kind,
      categorySlug: libraryCategories.slug,
      status: components.status,
      latestVersion: components.latestVersion,
      usageSiteCount: components.usageSiteCount,
      draftDocumentId: components.draftDocumentId,
      updatedAt: components.updatedAt,
    })
    .from(components)
    .innerJoin(libraryCategories, eq(components.categoryId, libraryCategories.id))
    .where(where)
    .orderBy(desc(components.updatedAt))
    .limit(filter.limit)
    .offset(filter.offset);

  const [row] = await exec
    .select({ total: sql<number>`count(*)::int` })
    .from(components)
    .innerJoin(libraryCategories, eq(components.categoryId, libraryCategories.id))
    .where(where);
  return { items, total: row?.total ?? 0 };
}

export interface VersionListRow {
  version: string | null;
  versionSeq: number | null;
  status: (typeof schema.libraryStatusEnum.enumValues)[number];
  bump: (typeof schema.versionBumpEnum.enumValues)[number] | null;
  changelog: { id: string; en: string } | null;
  yanked: boolean;
  createdAt: Date;
}

/** Riwayat versi component (T3.8.2) — terbaru dulu. Draft (versionSeq null) ikut agar admin lihat state saat ini. */
export async function listVersions(exec: DbExecutor, componentId: string): Promise<VersionListRow[]> {
  return exec
    .select({
      version: componentVersions.version,
      versionSeq: componentVersions.versionSeq,
      status: componentVersions.status,
      bump: componentVersions.bump,
      changelog: componentVersions.changelog,
      yanked: componentVersions.yanked,
      createdAt: componentVersions.createdAt,
    })
    .from(componentVersions)
    .where(eq(componentVersions.componentId, componentId))
    .orderBy(desc(componentVersions.versionSeq));
}

export type ComponentRow = typeof components.$inferSelect;
export type VersionRow = typeof componentVersions.$inferSelect;
export type ComponentInsert = typeof components.$inferInsert;
export type VersionInsert = typeof componentVersions.$inferInsert;

export async function findComponent(exec: DbExecutor, id: string): Promise<ComponentRow | undefined> {
  const rows = await exec
    .select()
    .from(components)
    .where(and(eq(components.id, id), eq(components.ownerType, "platform")))
    .limit(1);
  return rows[0];
}

// Instance dokumen merujuk component lewat `public_id` (`cmp_…`, DM-018) → resolusi registry editor (draft) lewat ini.
export async function findComponentByPublicId(exec: DbExecutor, publicId: string): Promise<ComponentRow | undefined> {
  const rows = await exec
    .select()
    .from(components)
    .where(and(eq(components.publicId, publicId), eq(components.ownerType, "platform")))
    .limit(1);
  return rows[0];
}

export async function findVersion(exec: DbExecutor, versionId: string): Promise<VersionRow | undefined> {
  const rows = await exec.select().from(componentVersions).where(eq(componentVersions.id, versionId)).limit(1);
  return rows[0];
}

// CMP-046: versi target rollback by (component, version_seq).
export async function findVersionBySeq(
  exec: DbExecutor,
  componentId: string,
  versionSeq: number,
): Promise<VersionRow | undefined> {
  const rows = await exec
    .select()
    .from(componentVersions)
    .where(and(eq(componentVersions.componentId, componentId), eq(componentVersions.versionSeq, versionSeq)))
    .limit(1);
  return rows[0];
}

export async function maxVersionSeq(exec: DbExecutor, componentId: string): Promise<number> {
  const rows = await exec
    .select({ versionSeq: componentVersions.versionSeq })
    .from(componentVersions)
    .where(eq(componentVersions.componentId, componentId))
    .orderBy(desc(componentVersions.versionSeq))
    .limit(1);
  return rows[0]?.versionSeq ?? 0;
}

export async function insertComponent(exec: DbExecutor, values: ComponentInsert): Promise<void> {
  await exec.insert(components).values(values);
}

// Mode Admin (Approach A, T3.4.2): draft component = dokumen Yjs `kind='component'` (GLOBAL, workspace null). Isi awal
// = snapshot uptoSeq 0 (state + JSON), seperti situs (writeInitialDocument). Realtime memuatnya sebagai titik awal.
export async function createComponentDraftDocument(
  exec: DbExecutor,
  input: { schemaVersion: number; state: Uint8Array; json: unknown; createdBy: string | null },
): Promise<string> {
  const [doc] = await exec
    .insert(documents)
    .values({ kind: "component", schemaVersion: input.schemaVersion })
    .returning({ id: documents.id });
  if (!doc) throw new Error("insert dokumen component gagal");
  const [snapshot] = await exec
    .insert(documentSnapshots)
    .values({
      documentId: doc.id,
      uptoSeq: 0,
      state: input.state,
      json: input.json,
      kind: "auto",
      createdBy: input.createdBy,
    })
    .returning({ id: documentSnapshots.id });
  if (!snapshot) throw new Error("insert snapshot awal gagal");
  await exec
    .update(documents)
    .set({ lastSnapshotId: snapshot.id, sizeBytes: input.state.byteLength })
    .where(eq(documents.id, doc.id));
  return doc.id;
}

// State Yjs draft terkini dari DB (snapshot + update seq > upto, digabung). Dipakai publish (D5: baca Yjs → definisi).
// Catatan: bisa tertinggal dari realtime (debounce flush); publish mengandalkan state tersimpan terakhir.
export async function loadDraftDocumentState(
  exec: DbExecutor,
  documentId: string,
): Promise<{ schemaVersion: number; state: Uint8Array } | undefined> {
  const [doc] = await exec
    .select({ schemaVersion: documents.schemaVersion, lastSnapshotId: documents.lastSnapshotId })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.kind, "component")));
  if (!doc) return undefined;
  const [snapshot] = doc.lastSnapshotId
    ? await exec
        .select({ state: documentSnapshots.state, uptoSeq: documentSnapshots.uptoSeq })
        .from(documentSnapshots)
        .where(and(eq(documentSnapshots.id, doc.lastSnapshotId), eq(documentSnapshots.documentId, documentId)))
    : [];
  const updates = await exec
    .select({ update: documentUpdates.update })
    .from(documentUpdates)
    .where(and(eq(documentUpdates.documentId, documentId), gt(documentUpdates.seq, snapshot?.uptoSeq ?? 0)))
    .orderBy(asc(documentUpdates.seq));
  const parts = [...(snapshot ? [snapshot.state] : []), ...updates.map((row) => row.update)];
  return { schemaVersion: doc.schemaVersion, state: mergeDocumentUpdates(parts) };
}

export async function insertVersion(exec: DbExecutor, values: VersionInsert): Promise<string> {
  const rows = await exec.insert(componentVersions).values(values).returning({ id: componentVersions.id });
  const id = rows[0]?.id;
  if (!id) throw new Error("insert component_versions tidak mengembalikan id");
  return id;
}

export async function updateComponent(exec: DbExecutor, id: string, patch: Partial<ComponentInsert>): Promise<void> {
  await exec
    .update(components)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(components.id, id));
}

// Hanya baris draft yang boleh di-UPDATE (trigger `component_versions_immutable` menolak UPDATE baris published).
export async function updateVersion(exec: DbExecutor, id: string, patch: Partial<VersionInsert>): Promise<void> {
  await exec
    .update(componentVersions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(componentVersions.id, id));
}

export interface UsageRow {
  version: string;
  docState: "draft" | "published";
  siteCount: number;
  instanceCount: number;
}

// Agregasi per (versi, docState) di JS — pemakaian per component ≤ ribuan baris & hanya untuk panel admin.
export async function usageByComponent(exec: DbExecutor, componentId: string): Promise<UsageRow[]> {
  const rows = await exec
    .select({
      version: siteComponentUsage.version,
      docState: siteComponentUsage.docState,
      instanceCount: siteComponentUsage.instanceCount,
    })
    .from(siteComponentUsage)
    .where(eq(siteComponentUsage.componentId, componentId));
  const byKey = new Map<string, UsageRow>();
  for (const row of rows) {
    const key = `${row.version} ${row.docState}`;
    const acc = byKey.get(key) ?? { version: row.version, docState: row.docState, siteCount: 0, instanceCount: 0 };
    acc.siteCount += 1;
    acc.instanceCount += row.instanceCount;
    byKey.set(key, acc);
  }
  return [...byKey.values()];
}

// --- Theme preset (CMP-120/CMP-124) ---
export interface ThemeSummaryRow {
  id: string;
  slug: string;
  displayName: { id: string; en: string };
  mode: (typeof schema.themeModeEnum.enumValues)[number];
  tags: string[];
  version: number;
  status: (typeof schema.libraryStatusEnum.enumValues)[number];
  sortOrder: number;
}
export interface ThemeRow extends ThemeSummaryRow {
  theme: Record<string, unknown>;
}

const themeSummaryCols = {
  id: themes.id,
  slug: themes.slug,
  displayName: themes.displayName,
  mode: themes.mode,
  tags: themes.tags,
  version: themes.version,
  status: themes.status,
  sortOrder: themes.sortOrder,
} as const;

/** Preset theme platform (owner_type='platform'), urut sortOrder lalu slug. */
export async function listPlatformThemes(exec: DbExecutor): Promise<ThemeSummaryRow[]> {
  return exec
    .select(themeSummaryCols)
    .from(themes)
    .where(eq(themes.ownerType, "platform"))
    .orderBy(asc(themes.sortOrder), asc(themes.slug));
}

/** Satu preset platform by slug (termasuk definisi theme lengkap). */
export async function getPlatformThemeBySlug(exec: DbExecutor, slug: string): Promise<ThemeRow | undefined> {
  const [row] = await exec
    .select({ ...themeSummaryCols, theme: themes.tokens })
    .from(themes)
    .where(and(eq(themes.ownerType, "platform"), eq(themes.slug, slug)))
    .limit(1);
  return row;
}

/** Simpan preset platform (edit admin): tokens + metadata, naikkan `version`. Mengembalikan ringkasan baru. */
export async function updatePlatformTheme(
  exec: DbExecutor,
  slug: string,
  patch: {
    theme: Record<string, unknown>;
    displayName?: { id: string; en: string };
    mode?: (typeof schema.themeModeEnum.enumValues)[number];
    tags?: string[];
  },
): Promise<ThemeSummaryRow | undefined> {
  const [row] = await exec
    .update(themes)
    .set({
      tokens: patch.theme,
      ...(patch.displayName ? { displayName: patch.displayName } : {}),
      ...(patch.mode ? { mode: patch.mode } : {}),
      ...(patch.tags ? { tags: patch.tags } : {}),
      version: sql`${themes.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(themes.ownerType, "platform"), eq(themes.slug, slug)))
    .returning(themeSummaryCols);
  return row;
}
