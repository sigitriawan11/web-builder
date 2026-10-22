import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { components, themes } from "../src/schema/library";
import { createTestDb, type TestDb } from "../test/test-db";
import { importLibraryToDb } from "./library";

// T3.11.1 / CMP-120/124: `importLibraryToDb` mem-publish 6 preset theme + component seed. Idempoten (upsert).
let testDb: TestDb;
beforeAll(async () => {
  testDb = await createTestDb();
});
afterAll(async () => {
  await testDb.drop();
});

describe("importLibraryToDb — theme preset (CMP-120)", () => {
  it("publish ≥6 preset theme (platform, published) + idempoten", async () => {
    const first = await importLibraryToDb(testDb.db);
    expect(first.themes).toBeGreaterThanOrEqual(6);
    expect(first.components).toBeGreaterThanOrEqual(1);

    const rows = await testDb.db.select().from(themes).where(eq(themes.ownerType, "platform"));
    expect(rows.length).toBeGreaterThanOrEqual(6);
    for (const row of rows) {
      expect(row.status).toBe("published");
      // `tokens` menyimpan Theme lengkap (tokens + fonts) agar situs bisa menyalin saat memilih preset.
      const theme = row.tokens as { tokens?: unknown; fonts?: unknown[] };
      expect(theme.tokens).toBeTruthy();
      expect(Array.isArray(theme.fonts)).toBe(true);
    }

    // Idempoten: jalankan lagi → jumlah theme/component tidak bertambah.
    await importLibraryToDb(testDb.db);
    expect(await testDb.db.$count(themes)).toBe(rows.length);
    const compCount = await testDb.db.$count(components);
    expect(compCount).toBeGreaterThanOrEqual(1);
  });
});
