import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./test-db";

let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

describe("database test dari template", () => {
  it("sudah berisi semua migration (tabel & role platform_app)", async () => {
    const tables = await testDb.db.execute<{ table_name: string }>(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(["users", "workspaces", "sites", "documents", "document_updates", "assets", "audit_logs"]),
    );
    const role = await testDb.db.execute(sql`SELECT 1 FROM pg_roles WHERE rolname = 'platform_app'`);
    expect(role.rows).toHaveLength(1);
  });
});
