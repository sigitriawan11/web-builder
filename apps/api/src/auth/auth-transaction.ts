import { AsyncLocalStorage } from "node:async_hooks";
import type { Db, DbTransaction } from "@platform/db";

// Better Auth membungkus registrasi dalam satu transaksi (`runWithTransaction`), tetapi hook `*.after`-nya baru
// berjalan setelah commit. Agar baris milik platform (consent, nanti personal workspace T1.5.10) masuk transaksi
// yang SAMA dengan user (ACC-001), transaksi Drizzle yang dibuka adapter dicatat di sini dan dipakai hook
// `*.before` lewat repository biasa. Efek samping keluar (enqueue email) ditunda sampai commit (`afterAuthCommit`).

interface TrackedTransaction {
  tx: DbTransaction;
  afterCommit: Array<() => void>;
}

const storage = new AsyncLocalStorage<TrackedTransaction>();

/** `db` untuk drizzleAdapter: identik, hanya `transaction()` yang mencatat transaksi aktif & callback setelah commit. */
export function trackTransactions(db: Db): Db {
  const tracked: Db = Object.create(db);
  tracked.transaction = (async (fn, config) => {
    const afterCommit: Array<() => void> = [];
    const result = await db.transaction((tx) => storage.run({ tx, afterCommit }, () => fn(tx)), config);
    for (const callback of afterCommit) callback();
    return result;
  }) as Db["transaction"];
  return tracked;
}

/** Transaksi Better Auth yang sedang berjalan; di luar transaksi → error (bug urutan hook, bukan kondisi normal). */
export function currentAuthTransaction(): DbTransaction {
  const tracked = storage.getStore();
  if (!tracked)
    throw new Error("hook auth dipanggil di luar transaksi Better Auth (drizzleAdapter transaction: true?)");
  return tracked.tx;
}

/**
 * Jalankan `callback` setelah transaksi auth aktif commit (rollback → tidak dijalankan); di luar transaksi → langsung.
 * `callback` tidak boleh melempar (menangani error-nya sendiri), karena commit sudah terjadi.
 */
export function afterAuthCommit(callback: () => void): void {
  const tracked = storage.getStore();
  if (tracked) tracked.afterCommit.push(callback);
  else callback();
}
