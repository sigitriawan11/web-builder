import type { Db, DbTransaction } from "@platform/db";
import type { Logger } from "@platform/shared/node";

// Pola outbox sederhana (ARCHITECTURE §18 "Transaksi"): efek samping (enqueue job, email, …) didaftarkan di dalam
// transaksi lewat `afterCommit` dan baru dijalankan SETELAH commit. Rollback → callback dibuang.

export type AfterCommit = (effect: () => Promise<unknown>) => void;

export async function withTransaction<T>(
  db: Db,
  logger: Logger,
  work: (tx: DbTransaction, afterCommit: AfterCommit) => Promise<T>,
): Promise<T> {
  const effects: (() => Promise<unknown>)[] = [];
  const result = await db.transaction((tx) => work(tx, (effect) => effects.push(effect)));
  // Data sudah commit: kegagalan efek (mis. Redis mati) tidak membatalkan request, tetapi wajib tercatat
  // agar bisa dipulihkan (job rekonsiliasi / retry manual).
  for (const effect of effects) {
    try {
      await effect();
    } catch (error) {
      logger.error({ err: error }, "efek afterCommit gagal setelah transaksi commit");
    }
  }
  return result;
}
