import type { AssetEntry } from "@platform/document-model";
import { sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { softDelete, timestamps } from "../columns";
import { users } from "./identity";
import { sites } from "./sites";
import { workspaces } from "./workspaces";

// Asset upload (ARCHITECTURE §6.3; dipakai upload M2). PK = ID yang tertulis di dokumen (`ast_…`, spec 01
// DM-007/DM-057, DM-078) — pengecualian aturan UUIDv7 untuk ID di dalam dokumen (ARCHITECTURE §6.1). ID dibuat
// service (document-model `createId("ast")`), bukan default database.

// Harus sama dengan `AssetEntry.kind` dokumen (dicek tipe).
const ASSET_KINDS = ["image", "video", "file", "font", "svg"] as const satisfies readonly AssetEntry["kind"][];
type MissingKind = Exclude<AssetEntry["kind"], (typeof ASSET_KINDS)[number]>;
const _allKindsCovered: MissingKind extends never ? true : false = true;
void _allKindsCovered;

export const assetKindEnum = pgEnum("asset_kind", ASSET_KINDS);
export const assetStatusEnum = pgEnum("asset_status", ["pending", "ready", "rejected"]);

export const assets = pgTable(
  "assets",
  {
    id: text().primaryKey(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    // null = pustaka workspace (dipakai lintas situs). Purge situs wajib menghapus asset & objek storage dulu.
    siteId: uuid().references(() => sites.id, { onDelete: "restrict" }),
    kind: assetKindEnum().notNull(),
    storageKey: text().notNull(),
    mime: text().notNull(),
    sizeBytes: bigint({ mode: "number" }).notNull(),
    width: integer(),
    height: integer(),
    blurhash: text(),
    // Dedupe per workspace (upload ulang file yang sama).
    sha256: text(),
    variants: jsonb().$type<Record<string, unknown>>(),
    status: assetStatusEnum().notNull().default("pending"),
    uploadedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    check("assets_id_format", sql`${table.id} ~ '^ast_[0-9a-z]{6,24}$'`),
    check("assets_size_nonnegative", sql`${table.sizeBytes} >= 0`),
    index("assets_site_id_created_at_idx").on(table.siteId, table.createdAt),
    index("assets_workspace_id_sha256_idx").on(table.workspaceId, table.sha256),
  ],
);

// Pemakaian storage per workspace untuk kuota (`storage.bytesMax`, spec 08); diperbarui saat upload/hapus.
export const storageUsage = pgTable(
  "storage_usage",
  {
    workspaceId: uuid()
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    bytesUsed: bigint({ mode: "number" }).notNull().default(0),
    updatedAt: timestamps.updatedAt,
  },
  (table) => [check("storage_usage_bytes_nonnegative", sql`${table.bytesUsed} >= 0`)],
);
