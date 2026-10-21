import { and, type Db, eq, schema } from "@platform/db";

// SATU-SATUNYA tempat modul library mengakses tabel (CLAUDE.md, ARCHITECTURE §6.2). Library platform = global (bukan
// tenant): tidak ada scope workspace/site; hanya versi `published` & `owner_type='platform'` yang boleh dibaca.
const { components, componentVersions } = schema;

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
