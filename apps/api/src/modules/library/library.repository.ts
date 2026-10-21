import { and, asc, type Db, eq, ilike, schema } from "@platform/db";

// SATU-SATUNYA tempat modul library mengakses tabel (CLAUDE.md, ARCHITECTURE §6.2). Library platform = global (bukan
// tenant): tidak ada scope workspace/site; hanya versi `published` & `owner_type='platform'` yang boleh dibaca.
const { components, componentVersions, libraryCategories } = schema;

export interface LibraryListItem {
  publicId: string;
  name: string;
  displayName: { id: string; en: string };
  categorySlug: string;
  kind: (typeof components.kind.enumValues)[number];
  version: number;
  thumbnailUrl: string | null;
}

// Daftar component published (T3.6.1) utk panel Insert: hanya `status='published'` (bukan deprecated/archived) & punya
// versi terbaru. Filter opsional kategori (slug) & pencarian nama. Global — tanpa scope tenant.
export async function listPublishedComponents(
  db: Db,
  filter: { category?: string; search?: string },
): Promise<LibraryListItem[]> {
  const conditions = [
    eq(components.ownerType, "platform"),
    eq(components.status, "published"),
    eq(componentVersions.status, "published"),
    eq(componentVersions.yanked, false),
  ];
  if (filter.category) conditions.push(eq(libraryCategories.slug, filter.category));
  if (filter.search) conditions.push(ilike(components.name, `%${filter.search}%`));
  const rows = await db
    .select({
      publicId: components.publicId,
      name: components.name,
      displayName: components.displayName,
      categorySlug: libraryCategories.slug,
      kind: components.kind,
      version: componentVersions.versionSeq,
      thumbnailUrl: components.thumbnailUrl,
    })
    .from(components)
    .innerJoin(libraryCategories, eq(components.categoryId, libraryCategories.id))
    .innerJoin(componentVersions, eq(components.latestVersionId, componentVersions.id))
    .where(and(...conditions))
    .orderBy(asc(components.name));
  // `version_seq` bertipe nullable di schema; innerJoin versi published menjamin ada → saring null defensif.
  return rows.flatMap((row) => (row.version === null ? [] : [{ ...row, version: row.version }]));
}

export interface LibraryDefinition {
  componentId: string;
  version: number;
  semver: string | null;
  definition: unknown;
  // Hash kanonik tersimpan saat publish (CMP-044) — diverifikasi service saat load.
  contentHash: string | null;
}

/** Definisi versi published (immutable) by `public_id` (`cmp_…`) + `version_seq`. `undefined` bila tidak ada. */
export async function findPublishedDefinition(
  db: Db,
  publicId: string,
  versionSeq: number,
): Promise<LibraryDefinition | undefined> {
  const rows = await db
    .select({
      definition: componentVersions.definition,
      semver: componentVersions.version,
      contentHash: componentVersions.contentHash,
    })
    .from(componentVersions)
    .innerJoin(components, eq(componentVersions.componentId, components.id))
    .where(
      and(
        eq(components.publicId, publicId),
        eq(components.ownerType, "platform"),
        eq(componentVersions.versionSeq, versionSeq),
        eq(componentVersions.status, "published"),
        eq(componentVersions.yanked, false),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row
    ? {
        componentId: publicId,
        version: versionSeq,
        semver: row.semver,
        definition: row.definition,
        contentHash: row.contentHash,
      }
    : undefined;
}
