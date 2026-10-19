import { and, type DbExecutor, eq, inArray, type SystemTenant, schema } from "@platform/db";
import type { ComponentUsageEntry } from "@platform/document-model";

// CMP-051/CMP-156: read model `site_component_usage`. Realtime menyentuh tabel HANYA di repository (ARCHITECTURE §6.2).
// Dokumen merujuk component lewat `cmp_…` (public_id) + `version_seq` (int); tabel memakai `components.id` (UUID) +
// `version` (semver text) → repository memetakannya. Referensi yang tak ter-resolve (component/versi belum ada di DB,
// mis. component site-lokal belum tersimpan) dilewati & dilaporkan, tidak membuat proyeksi gagal.

export type UsageDocState = (typeof schema.usageDocStateEnum.enumValues)[number];

export interface ReplaceUsageResult {
  // `false` bila dokumen bukan milik situs (library) → tidak ada usage.
  written: boolean;
  recorded: number;
  skipped: { componentId: string; version: number }[];
}

export async function replaceSiteComponentUsage(
  db: DbExecutor,
  _tenant: SystemTenant,
  documentId: string,
  docState: UsageDocState,
  entries: readonly ComponentUsageEntry[],
): Promise<ReplaceUsageResult> {
  return db.transaction(async (tx) => {
    const [document] = await tx
      .select({ siteId: schema.documents.siteId })
      .from(schema.documents)
      .where(eq(schema.documents.id, documentId));
    const siteId = document?.siteId;
    if (!siteId) return { written: false, recorded: 0, skipped: [] };

    const resolved = entries.length > 0 ? await resolveRows(tx, siteId, docState, entries) : { rows: [], skipped: [] };
    // Bangun ulang baris situs+docState ini (read model, tanpa soft delete).
    await tx
      .delete(schema.siteComponentUsage)
      .where(and(eq(schema.siteComponentUsage.siteId, siteId), eq(schema.siteComponentUsage.docState, docState)));
    if (resolved.rows.length > 0) await tx.insert(schema.siteComponentUsage).values(resolved.rows);
    return { written: true, recorded: resolved.rows.length, skipped: resolved.skipped };
  });
}

async function resolveRows(
  tx: DbExecutor,
  siteId: string,
  docState: UsageDocState,
  entries: readonly ComponentUsageEntry[],
) {
  const publicIds = [...new Set(entries.map((entry) => entry.componentId))];
  const componentRows = await tx
    .select({ id: schema.components.id, publicId: schema.components.publicId })
    .from(schema.components)
    .where(inArray(schema.components.publicId, publicIds));
  const uuidByPublicId = new Map(componentRows.map((row) => [row.publicId, row.id]));

  const componentUuids = [...uuidByPublicId.values()];
  const versionRows =
    componentUuids.length > 0
      ? await tx
          .select({
            id: schema.componentVersions.id,
            componentId: schema.componentVersions.componentId,
            versionSeq: schema.componentVersions.versionSeq,
            version: schema.componentVersions.version,
          })
          .from(schema.componentVersions)
          .where(inArray(schema.componentVersions.componentId, componentUuids))
      : [];
  // key `${componentUuid}@${versionSeq}` → { versionId, semver }.
  const versionByKey = new Map<string, { id: string; version: string }>();
  for (const row of versionRows) {
    if (row.versionSeq !== null && row.version !== null) {
      versionByKey.set(`${row.componentId}@${row.versionSeq}`, { id: row.id, version: row.version });
    }
  }

  const rows: (typeof schema.siteComponentUsage.$inferInsert)[] = [];
  const skipped: { componentId: string; version: number }[] = [];
  for (const entry of entries) {
    const componentUuid = uuidByPublicId.get(entry.componentId);
    const version = componentUuid ? versionByKey.get(`${componentUuid}@${entry.version}`) : undefined;
    if (!componentUuid || !version) {
      skipped.push({ componentId: entry.componentId, version: entry.version });
      continue;
    }
    rows.push({
      siteId,
      componentId: componentUuid,
      componentVersionId: version.id,
      version: version.version,
      docState,
      instanceCount: entry.instanceCount,
      pageIds: entry.pageIds,
      hasOverrides: entry.hasOverrides,
    });
  }
  return { rows, skipped };
}
