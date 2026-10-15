import { type Db, sql } from "@platform/db";

// Data operasional lintas tenant (pemeliharaan penyimpanan dokumen), bukan akses data tenant atas nama user.

/**
 * Dokumen yang punya baris `document_updates` yang sudah tercakup snapshot terbarunya (`seq <= upto_seq`) —
 * kandidat compaction ARCHITECTURE §7.4. Hanya dihitung; penghapusan menunggu retensi paket (M4).
 */
export async function countCompactionCandidates(db: Db): Promise<{ documents: number; updates: number }> {
  const result = await db.execute<{ documents: number; updates: number }>(sql`
    select count(distinct u.document_id)::int as documents, count(*)::int as updates
    from document_updates u
    join documents d on d.id = u.document_id
    join document_snapshots s on s.id = d.last_snapshot_id
    where u.seq <= s.upto_seq
  `);
  const row = result.rows[0];
  return { documents: row?.documents ?? 0, updates: row?.updates ?? 0 };
}
