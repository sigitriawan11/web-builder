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
import { id, timestamps } from "../columns";
import { documents } from "./documents";
import { users } from "./identity";
import { sites } from "./sites";

// Library component/theme berversi (CMP-150–CMP-156). Schema & migration HANYA di sini (CLAUDE.md § Database).
// `search_vector` (tsvector, CMP-160) & `embedding` (pgvector, P1) ditambah bersama fiturnya.

// Label/konten dwibahasa (ID default, EN) — ACC-292.
type Localized = { id: string; en: string };

export const libraryScopeEnum = pgEnum("library_scope", ["component", "template", "both"]);
export const libraryCategoryTypeEnum = pgEnum("library_category_type", ["functional", "industry"]);
export const libraryOwnerTypeEnum = pgEnum("library_owner_type", ["platform", "user", "vendor"]);
export const componentKindEnum = pgEnum("component_kind", ["element", "block", "section", "page", "layout"]);
export const libraryStatusEnum = pgEnum("library_status", [
  "draft",
  "in_review",
  "published",
  "deprecated",
  "archived",
]);
export const versionBumpEnum = pgEnum("version_bump", ["major", "minor", "patch"]);

// CMP-150: kategori library (fungsional + industri), hierarki 2 level.
export const libraryCategories = pgTable("library_categories", {
  id: id(),
  slug: text().notNull().unique(),
  scope: libraryScopeEnum().notNull(),
  type: libraryCategoryTypeEnum().notNull(),
  parentId: uuid().references((): AnyPgColumn => libraryCategories.id, { onDelete: "set null" }),
  name: jsonb().$type<Localized>().notNull(),
  description: jsonb().$type<Localized>(),
  icon: text(),
  sortOrder: integer().notNull().default(0),
  ...timestamps,
});

// CMP-151: component library (ringkasan; definisi per versi di component_versions). Owner platform/user/vendor
// (user/vendor = P2; kolom disiapkan sejak M3 agar tak perlu migrasi besar, O-1/CMP-004).
export const components = pgTable(
  "components",
  {
    // UUID v5 (dari slug) untuk seed, v7 untuk yang dibuat di editor — keduanya disuplai service, bukan default DB.
    id: uuid().primaryKey(),
    // ID yang DIRUJUK dokumen (instance.props.componentId, componentDeps — DM-007/DM-018, `cmp_…`). Terpisah dari
    // UUID PK internal (CMP-151) agar dua spec konsisten: dokumen pakai `cmp_…`, DB PK tetap UUID. Lampiran D 2026-10-19.
    publicId: text().notNull().unique(),
    slug: text().notNull(),
    ownerType: libraryOwnerTypeEnum().notNull(),
    ownerId: uuid(),
    kind: componentKindEnum().notNull(),
    categoryId: uuid()
      .notNull()
      .references(() => libraryCategories.id, { onDelete: "restrict" }),
    name: text().notNull(),
    displayName: jsonb().$type<Localized>().notNull(),
    description: jsonb().$type<Localized>().notNull(),
    tags: text().array().notNull().default(sql`'{}'`),
    keywords: jsonb().$type<{ id: string[]; en: string[] }>(),
    industries: text().array().notNull().default(sql`'{}'`),
    aiHints: text(),
    requiresFeatures: text().array().notNull().default(sql`'{}'`),
    // Gating paket — null = gratis untuk semua (O-1: library statis gratis; kolom disiapkan).
    minPlan: text(),
    status: libraryStatusEnum().notNull().default("draft"),
    // FK ke component_versions ditambah sebagai constraint terpisah di migrasi (hindari siklus definisi tabel).
    latestVersionId: uuid(),
    latestVersion: text(),
    draftVersionId: uuid(),
    // Mode Admin (Approach A, T3.4.2): draft component = dokumen Yjs `kind='component'`. Satu draft aktif per
    // component; hapus dokumen → set null (component tetap ada).
    draftDocumentId: uuid().references(() => documents.id, { onDelete: "set null" }),
    replacedByComponentId: uuid().references((): AnyPgColumn => components.id, { onDelete: "set null" }),
    thumbnailUrl: text(),
    usageSiteCount: integer().notNull().default(0),
    generatedByAi: boolean().notNull().default(false),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    deprecatedAt: timestamp({ withTimezone: true }),
    archivedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // CMP-004: slug unik per owner. Platform (owner_id null) butuh unik (owner_type, slug) — NULLS NOT DISTINCT
    // belum ada di drizzle 0.45, jadi dua partial unique index (platform vs user/vendor) memberi jaminan sama.
    uniqueIndex("components_platform_slug_idx").on(table.ownerType, table.slug).where(sql`${table.ownerId} is null`),
    uniqueIndex("components_owner_slug_idx")
      .on(table.ownerType, table.ownerId, table.slug)
      .where(sql`${table.ownerId} is not null`),
    index("components_owner_status_idx").on(table.ownerType, table.status),
    index("components_category_idx").on(table.categoryId),
    index("components_tags_idx").using("gin", table.tags),
    index("components_industries_idx").using("gin", table.industries),
  ],
);

// CMP-152/CMP-044: versi component — IMMUTABLE setelah published (trigger menolak UPDATE, ditambah di migrasi).
export const componentVersions = pgTable(
  "component_versions",
  {
    id: id(),
    componentId: uuid()
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    // null selama draft; terisi saat publish.
    version: text(),
    versionSeq: integer(),
    bump: versionBumpEnum(),
    status: libraryStatusEnum().notNull().default("draft"),
    yanked: boolean().notNull().default(false),
    definition: jsonb().$type<Record<string, unknown>>().notNull(),
    propsSchemaHash: text(),
    contentHash: text(),
    changelog: jsonb().$type<Localized>(),
    qaReport: jsonb().$type<Record<string, unknown>>(),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("component_versions_component_version_idx").on(table.componentId, table.version),
    index("component_versions_component_seq_idx").on(table.componentId, table.versionSeq),
  ],
);

// CMP-014: thumbnail per breakpoint untuk sebuah versi component. Tabel TERPISAH (bukan kolom di `component_versions`)
// karena baris published immutable (trigger) — thumbnail dihasilkan worker SETELAH publish. `assetKey` = key objek di
// bucket `assets`; URL publik diturunkan dari key (tak disimpan). Upsert ulang saat re-generate.
export const componentThumbnailBreakpointEnum = pgEnum("component_thumbnail_breakpoint", ["base", "tablet", "mobile"]);

export const componentVersionThumbnails = pgTable(
  "component_version_thumbnails",
  {
    id: id(),
    componentVersionId: uuid()
      .notNull()
      .references(() => componentVersions.id, { onDelete: "cascade" }),
    breakpoint: componentThumbnailBreakpointEnum().notNull(),
    assetKey: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("component_version_thumbnails_version_bp_idx").on(table.componentVersionId, table.breakpoint),
  ],
);

export const themeModeEnum = pgEnum("theme_mode", ["light", "dark"]);
export const usageDocStateEnum = pgEnum("usage_doc_state", ["draft", "published"]);

// CMP-155: theme preset library. Theme situs sendiri disimpan di dokumen (`site.theme`); `sites.theme_source_id`
// mencatat asal preset. `version` int naik tiap edit preset (situs menyimpan salinan, DM-044).
export const themes = pgTable(
  "themes",
  {
    id: id(),
    slug: text().notNull(),
    ownerType: libraryOwnerTypeEnum().notNull(),
    ownerId: uuid(),
    displayName: jsonb().$type<Localized>().notNull(),
    tokens: jsonb().$type<Record<string, unknown>>().notNull(),
    mode: themeModeEnum().notNull().default("light"),
    tags: text().array().notNull().default(sql`'{}'`),
    industries: text().array().notNull().default(sql`'{}'`),
    version: integer().notNull().default(1),
    status: libraryStatusEnum().notNull().default("draft"),
    previewUrl: text(),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("themes_platform_slug_idx").on(table.ownerType, table.slug).where(sql`${table.ownerId} is null`),
    uniqueIndex("themes_owner_slug_idx")
      .on(table.ownerType, table.ownerId, table.slug)
      .where(sql`${table.ownerId} is not null`),
  ],
);

// CMP-156/CMP-051: pemakaian component per situs (dicatat dari projection realtime). PK komposit; hapus situs →
// cascade. Dipakai untuk notifikasi update (M4) & estimasi risiko. `site_update_notices` (M4) menyusul.
export const siteComponentUsage = pgTable(
  "site_component_usage",
  {
    siteId: uuid()
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    componentId: uuid()
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    componentVersionId: uuid().references(() => componentVersions.id, { onDelete: "set null" }),
    version: text().notNull(),
    docState: usageDocStateEnum().notNull(),
    instanceCount: integer().notNull().default(0),
    pageIds: text().array().notNull().default(sql`'{}'`),
    hasOverrides: boolean().notNull().default(false),
    lastIndexedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.siteId, table.componentId, table.version, table.docState] }),
    index("site_component_usage_component_version_idx").on(table.componentId, table.version),
    index("site_component_usage_site_idx").on(table.siteId),
  ],
);
