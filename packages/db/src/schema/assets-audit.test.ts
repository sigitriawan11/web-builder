import { readFileSync } from "node:fs";
import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { assetKindEnum, assets } from "./assets";
import { auditLogs } from "./audit";

describe("schema assets (DM-057, DM-078)", () => {
  it("PK = ID dokumen `ast_…` (text, tanpa default database); kind sama dengan AssetEntry dokumen", () => {
    const { id } = getTableColumns(assets);
    expect(id.getSQLType()).toBe("text");
    expect(id.primary).toBe(true);
    expect(id.hasDefault).toBe(false);
    expect(assetKindEnum.enumValues).toEqual(["image", "video", "file", "font", "svg"]);
    expect(getTableConfig(assets).checks.map((check) => check.name)).toEqual(
      expect.arrayContaining(["assets_id_format", "assets_size_nonnegative"]),
    );
  });
});

describe("schema audit_logs (ARCHITECTURE §9.10, spec 08 ACC-212)", () => {
  it("tanpa foreign key (log bertahan setelah data dihapus); actor_id text (bisa di-hash)", () => {
    expect(getTableConfig(auditLogs).foreignKeys).toHaveLength(0);
    expect(getTableColumns(auditLogs).actorId.getSQLType()).toBe("text");
    expect(getTableColumns(auditLogs).id.getSQLType()).toBe("bigint");
  });

  it("migration menegakkan append-only: REVOKE untuk platform_app + trigger UPDATE/DELETE/TRUNCATE", () => {
    const sql = readFileSync(new URL("../../migrations/0004_audit_append_only.sql", import.meta.url), "utf8");
    expect(sql).toContain("REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM platform_app");
    expect(sql).toContain("BEFORE UPDATE OR DELETE ON audit_logs");
    expect(sql).toContain("BEFORE TRUNCATE ON audit_logs");
  });
});
