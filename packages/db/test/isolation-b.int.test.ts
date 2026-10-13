import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { users, workspaces } from "../src/schema";
import { createTestDb, type TestDb } from "./test-db";

// T1.3.7: file ini & isolation-b memakai email/slug yang SAMA (unik di DB). Bila database dipakai bersama,
// salah satunya gagal; dengan database per file keduanya lulus walau berjalan paralel.
let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

describe("isolasi database test (B)", () => {
  it("menulis data dengan kunci unik yang sama dengan file B", async () => {
    const [user] = await testDb.db.insert(users).values({ name: "B", email: "sama@platform.test" }).returning();
    if (!user) throw new Error("insert user gagal");
    await new Promise((resolve) => setTimeout(resolve, 300)); // beri waktu file B berjalan bersamaan
    await testDb.db
      .insert(workspaces)
      .values({ slug: "ws_samasama01", type: "personal", name: "B", ownerUserId: user.id });
    expect(await testDb.db.$count(users)).toBe(1);
    expect((await testDb.db.select().from(users))[0]?.name).toBe("B");
  });
});
