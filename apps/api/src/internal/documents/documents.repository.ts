import { and, asc, type DbExecutor, eq, gt, type SystemTenant, schema } from "@platform/db";

// Akses dokumen lintas tenant untuk service internal (worker/realtime). `SystemTenant` wajib: alasan akses tercatat
// di log oleh pemanggil (ARCHITECTURE §6.2).

export interface StoredDocumentState {
  schemaVersion: number;
  lastSeq: number;
  // Snapshot terakhir (state + seq yang dicakup); null bila dokumen belum punya snapshot.
  snapshot: { state: Uint8Array; uptoSeq: number } | null;
  // Update setelah snapshot, urut seq.
  updates: Uint8Array[];
}

export async function loadStoredDocumentState(
  db: DbExecutor,
  _tenant: SystemTenant,
  documentId: string,
): Promise<StoredDocumentState | undefined> {
  const [document] = await db
    .select({
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
    schemaVersion: document.schemaVersion,
    lastSeq: document.lastSeq,
    snapshot: snapshot ?? null,
    updates: updates.map((row) => row.update),
  };
}
