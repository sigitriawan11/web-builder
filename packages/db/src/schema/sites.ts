import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, softDelete, timestamps } from "../columns";
import { documents } from "./documents";
import { workspaces } from "./workspaces";

// Situs & read model halaman (spec 01 DM-078, ARCHITECTURE §6.3). Isi situs (SEO, favicon, bahasa, tema) ada di
// dokumen — tidak diduplikasi di sini (DM-078). Kolom fase lanjut (`theme_id`, `live_deployment_id`,
// `is_dynamic`) ditambah bersama tabel tujuannya.

export const siteStatusEnum = pgEnum("site_status", ["draft", "published", "suspended", "archived"]);

/**
 * Pembuatan situs dalam satu transaksi (FK dua arah): insert `documents` (site_id null) → insert `sites`
 * (document_id) → update `documents.site_id`.
 */
export const sites = pgTable(
  "sites",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    name: text().notNull(),
    status: siteStatusEnum().notNull().default("draft"),
    documentId: uuid()
      .notNull()
      .unique("sites_document_id_key")
      .references((): AnyPgColumn => documents.id), // FK dua arah dengan documents.site_id
    ...timestamps,
    ...softDelete,
  },
  (table) => [index("sites_workspace_id_deleted_at_idx").on(table.workspaceId, table.deletedAt)],
);

/**
 * Read model halaman (turunan, dibangun ulang dari dokumen oleh ekstensi `projections` realtime, ARCHITECTURE §5.5):
 * dipakai dashboard & routing tanpa memuat Y.Doc. Halaman yang dihapus dari dokumen dihapus dari tabel ini.
 */
export const sitePages = pgTable(
  "site_pages",
  {
    siteId: uuid()
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    // ID node page di dokumen (`pg_…`, spec 01 DM-007) — unik per dokumen, bukan global.
    pageId: text().notNull(),
    path: text().notNull(),
    title: text().notNull(),
    seo: jsonb().$type<Record<string, unknown>>(),
    sortOrder: integer().notNull(),
    isHome: boolean().notNull().default(false),
    nodeCount: integer().notNull().default(0),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.siteId, table.pageId] }),
    uniqueIndex("site_pages_site_id_path_key").on(table.siteId, table.path),
    uniqueIndex("site_pages_one_home_key").on(table.siteId).where(sql`${table.isHome}`),
  ],
);
