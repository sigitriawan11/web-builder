import { and, asc, type DbExecutor, eq, gt, type SystemTenant, schema, sql } from "@platform/db";

// Akses dokumen untuk realtime (ARCHITECTURE §7): satu-satunya tempat realtime menyentuh tabel Drizzle. Koneksi sudah
// diautentikasi token per dokumen; `SystemTenant` mencatat alasan akses lintas tenant (ARCHITECTURE §6.2).

export interface StoredDocument {
  siteId: string | null;
  schemaVersion: number;
  lastSeq: number;
  snapshot: { state: Uint8Array; uptoSeq: number } | null;
  // Update setelah snapshot, urut seq.
  updates: Uint8Array[];
}

export async function loadStoredDocument(
  db: DbExecutor,
  _tenant: SystemTenant,
  documentId: string,
): Promise<StoredDocument | undefined> {
  const [document] = await db
    .select({
      siteId: schema.documents.siteId,
      schemaVersion: schema.documents.schemaVersion,
      lastSeq: schema.documents.lastSeq,
      lastSnapshotId: schema.documents.lastSnapshotId,
    })
    .from(schema.documents)
    .where(eq(schema.documents.id, documentId));
  if (!document) return undefined;

  const [snapshot] = document.lastSnapshotId
    ? await db
        .select({ state: schema.documentSnapshots.state, uptoSeq: schema.documentSnapshots.uptoSeq })
        .from(schema.documentSnapshots)
        .where(
          and(
            eq(schema.documentSnapshots.id, document.lastSnapshotId),
            eq(schema.documentSnapshots.documentId, documentId),
          ),
        )
    : [];
  const updates = await db
    .select({ update: schema.documentUpdates.update })
    .from(schema.documentUpdates)
    .where(
      and(eq(schema.documentUpdates.documentId, documentId), gt(schema.documentUpdates.seq, snapshot?.uptoSeq ?? 0)),
    )
    .orderBy(asc(schema.documentUpdates.seq));

  return {
    siteId: document.siteId,
    schemaVersion: document.schemaVersion,
    lastSeq: document.lastSeq,
    snapshot: snapshot ?? null,
    updates: updates.map((row) => row.update),
  };
}

export type UpdateOrigin = (typeof schema.documentUpdateOriginEnum.enumValues)[number];

export interface AppendUpdate {
  update: Uint8Array;
  origin: UpdateOrigin;
  actorId?: string | null;
}

/**
 * Tambah update berurutan (seq = last_seq + 1, …) dan majukan `documents.last_seq` dalam SATU transaksi (ARCHITECTURE
 * §7.2). Baris dokumen dikunci (`FOR UPDATE`) agar dua penulis tidak membuat seq bolong/ganda. `schemaVersion` diisi
 * saat migrasi.
 */
export async function appendDocumentUpdates(
  db: DbExecutor,
  _tenant: SystemTenant,
  documentId: string,
  updates: readonly AppendUpdate[],
  options: { schemaVersion?: number } = {},
): Promise<{ lastSeq: number }> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ lastSeq: schema.documents.lastSeq })
      .from(schema.documents)
      .where(eq(schema.documents.id, documentId))
      .for("update");
    if (!current) throw new Error(`dokumen ${documentId} tidak ada`);
    const rows = updates.map((item, index) => ({
      documentId,
      seq: current.lastSeq + index + 1,
      update: item.update,
      origin: item.origin,
      actorId: item.actorId ?? null,
    }));
    if (rows.length > 0) await tx.insert(schema.documentUpdates).values(rows);
    const lastSeq = current.lastSeq + rows.length;
    await tx
      .update(schema.documents)
      .set({
        lastSeq,
        ...(options.schemaVersion !== undefined ? { schemaVersion: options.schemaVersion } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(schema.documents.id, documentId));
    return { lastSeq };
  });
}
