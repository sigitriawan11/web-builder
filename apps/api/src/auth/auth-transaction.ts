import { AsyncLocalStorage } from "node:async_hooks";
import type { Db, DbTransaction } from "@platform/db";

// Better Auth membungkus registrasi dalam satu transaksi (`runWithTransaction`), tetapi hook `*.after`-nya baru
// berjalan setelah commit. Agar baris milik platform (consent, nanti personal workspace T1.5.10) masuk transaksi
// yang SAMA dengan user (ACC-001), transaksi Drizzle yang dibuka adapter dicatat di sini dan dipakai hook
// `*.before` lewat repository biasa.

const storage = new AsyncLocalStorage<DbTransaction>();

/** `db` untuk drizzleAdapter: identik, hanya `transaction()` yang mencatat transaksi aktif. */
export function trackTransactions(db: Db): Db {
  const tracked: Db = Object.create(db);
  tracked.transaction = ((fn, config) =>
    db.transaction((tx) => storage.run(tx, () => fn(tx)), config)) as Db["transaction"];
  return tracked;
}

/** Transaksi Better Auth yang sedang berjalan; di luar transaksi → error (bug urutan hook, bukan kondisi normal). */
export function currentAuthTransaction(): DbTransaction {
  const tx = storage.getStore();
  if (!tx) throw new Error("hook auth dipanggil di luar transaksi Better Auth (drizzleAdapter transaction: true?)");
  return tx;
}
