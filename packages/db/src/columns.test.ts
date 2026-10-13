import { UUIDV7_PATTERN } from "@platform/shared";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { getTableConfig, pgTable, text } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { id, identityId, softDelete, timestamps } from "./columns";

// Tabel contoh hanya untuk test (bukan schema nyata).
const examples = pgTable("example_items", {
  id: id(),
  workspaceId: text().notNull(),
  displayName: text(),
  ...timestamps,
  ...softDelete,
});
const events = pgTable("example_events", { id: identityId(), payload: text() });

const db = drizzle.mock({ casing: "snake_case" });

describe("helper kolom (ARCHITECTURE §6.1)", () => {
  it("nama kolom camelCase TS → snake_case di SQL", () => {
    const query = db.select().from(examples).where(eq(examples.workspaceId, "w1")).toSQL();
    expect(query.sql).toContain('"workspace_id"');
    expect(query.sql).toContain('"display_name"');
    expect(query.sql).toContain('"created_at"');
    expect(query.sql).toContain('"deleted_at"');
    expect(query.sql).not.toMatch(/"workspaceId"|"createdAt"/);
  });

  it("id = UUIDv7 dibuat aplikasi saat insert (bukan default database)", () => {
    const query = db.insert(examples).values({ workspaceId: "w1" }).toSQL();
    const generated = query.params.find((param) => typeof param === "string" && UUIDV7_PATTERN.test(param));
    expect(generated).toBeDefined();
    expect([examples.id.primary, examples.id.getSQLType()]).toEqual([true, "uuid"]);
  });

  it("created_at & updated_at timestamptz NOT NULL default now(); deleted_at nullable", () => {
    for (const column of [examples.createdAt, examples.updatedAt]) {
      expect(column.getSQLType()).toBe("timestamp with time zone");
      expect(column.notNull).toBe(true);
      expect(column.hasDefault).toBe(true);
    }
    expect(examples.deletedAt.getSQLType()).toBe("timestamp with time zone");
    expect(examples.deletedAt.notNull).toBe(false);
  });

  it("updated_at diisi otomatis pada update", () => {
    const query = db.update(examples).set({ displayName: "baru" }).where(eq(examples.id, "x")).toSQL();
    expect(query.sql).toMatch(/"updated_at" = \$\d/);
    expect(
      query.params.some(
        (param) => param instanceof Date || (typeof param === "string" && /^\d{4}-\d\d-\d\d/.test(param)),
      ),
    ).toBe(true);
  });

  it("identityId = bigint generated always as identity untuk tabel append-only", () => {
    expect(events.id.getSQLType()).toBe("bigint");
    expect(events.id.primary).toBe(true);
    expect(getTableConfig(events).columns.find((column) => column.primary)?.generatedIdentity?.type).toBe("always");
    // Identity diisi database (`default`), bukan aplikasi.
    expect(db.insert(events).values({ payload: "x" }).toSQL()).toEqual({
      sql: 'insert into "example_events" ("id", "payload") values (default, $1)',
      params: ["x"],
    });
  });
});
