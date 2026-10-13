import { uuidv7 } from "@platform/shared";
import { bigint, timestamp, uuid } from "drizzle-orm/pg-core";

// Helper kolom bersama (ARCHITECTURE §6.1). Nama kolom TS camelCase → snake_case otomatis lewat
// `casing: "snake_case"` di client & drizzle.config, jadi helper ini tidak menulis nama kolom.

/** Primary key UUIDv7 dibuat di aplikasi (terurut waktu, ramah index B-tree). */
export const id = () =>
  uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7());

/** Primary key `bigint generated always as identity` untuk tabel append-only bervolume tinggi
 *  (`document_updates`, `audit_logs`, `workflow_run_steps`, `credit_ledger`). */
export const identityId = () => bigint({ mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity();

const timestamptz = () => timestamp({ withTimezone: true });

/** `created_at` & `updated_at` (timestamptz, NOT NULL). `updated_at` diperbarui otomatis setiap update lewat Drizzle. */
export const timestamps = {
  createdAt: timestamptz().notNull().defaultNow(),
  updatedAt: timestamptz()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** `deleted_at` untuk entitas yang bisa dipulihkan (sites, assets, records, members, …); repository memfilter `IS NULL`. */
export const softDelete = {
  deletedAt: timestamptz(),
};
