import { createTestDb, type TestDb } from "@platform/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { afterAuthCommit, currentAuthTransaction, trackTransactions } from "./auth-transaction";

// Efek samping auth (enqueue email) hanya setelah commit; transaksi aktif tersedia untuk hook `*.before`.
let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

describe("trackTransactions / afterAuthCommit", () => {
  it("callback berjalan setelah commit, bukan di dalam transaksi", async () => {
    const events: string[] = [];
    await trackTransactions(testDb.db).transaction(async () => {
      expect(currentAuthTransaction()).toBeDefined();
      afterAuthCommit(() => events.push("email"));
      events.push("tulis");
    });
    expect(events).toEqual(["tulis", "email"]);
  });

  it("rollback → callback tidak pernah berjalan", async () => {
    const events: string[] = [];
    await expect(
      trackTransactions(testDb.db).transaction(async () => {
        afterAuthCommit(() => events.push("email"));
        throw new Error("gagal");
      }),
    ).rejects.toThrow("gagal");
    expect(events).toEqual([]);
  });

  it("di luar transaksi → langsung dijalankan; currentAuthTransaction melempar", () => {
    const events: string[] = [];
    afterAuthCommit(() => events.push("email"));
    expect(events).toEqual(["email"]);
    expect(() => currentAuthTransaction()).toThrow(/di luar transaksi/);
  });
});
