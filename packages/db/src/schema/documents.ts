import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea, id, identityId, timestamps } from "../columns";
import { users } from "./identity";
import { sites } from "./sites";
import { workspaces } from "./workspaces";

// Penyimpanan Y.Doc (ARCHITECTURE §7, spec 01 DM-061/DM-078): update append-only + snapshot berkala.

const timestamptz = () => timestamp({ withTimezone: true });

export const documentKindEnum = pgEnum("document_kind", ["site", "component", "template"]);
// Origin transaksi Yjs (spec 01 DM-060); `ai` = hasil Terapkan run AI.
export const documentUpdateOriginEnum = pgEnum("document_update_origin", ["local", "ai", "server", "migration"]);
// `migration` = sebelum & sesudah migrasi schemaVersion (DM-071); tidak di-thinning (ARCHITECTURE §7.4).
export const documentSnapshotKindEnum = pgEnum("document_snapshot_kind", [
  "auto",
  "named",
  "publish",
  "pre_ai",
  "migration",
]);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    // null untuk dokumen library (component/template draft).
    siteId: uuid().references((): AnyPgColumn => sites.id, { onDelete: "cascade" }),
    kind: documentKindEnum().notNull(),
    schemaVersion: integer().notNull(),
    // seq update terakhir yang sudah di-flush (realtime persistence, ARCHITECTURE §7.2).
    lastSeq: bigint({ mode: "number" }).notNull().default(0),
    lastSnapshotId: uuid().references((): AnyPgColumn => documentSnapshots.id, { onDelete: "set null" }),
    sizeBytes: bigint({ mode: "number" }).notNull().default(0),
    ...timestamps,
  },
  (table) => [index("documents_site_id_idx").on(table.siteId), index("documents_kind_idx").on(table.kind)],
);

/** Append-only bervolume tinggi → PK bigint identity (ARCHITECTURE §6.1). Tidak pernah di-UPDATE. */
export const documentUpdates = pgTable(
  "document_updates",
  {
    id: identityId(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    seq: bigint({ mode: "number" }).notNull(),
    update: bytea().notNull(),
    origin: documentUpdateOriginEnum().notNull(),
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    // FK ke ai_runs ditambah saat tabelnya dibuat (M6).
    aiRunId: uuid(),
    createdAt: timestamps.createdAt,
  },
  // Urutan replay & deteksi celah: satu seq per dokumen.
  (table) => [uniqueIndex("document_updates_document_id_seq_key").on(table.documentId, table.seq)],
);

export const documentSnapshots = pgTable(
  "document_snapshots",
  {
    id: id(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    // Snapshot mencakup semua update sampai seq ini (load = snapshot + update seq > upto_seq).
    uptoSeq: bigint({ mode: "number" }).notNull(),
    state: bytea().notNull(),
    // JSON snapshot tervalidasi (history, restore, publish); opsional untuk snapshot `auto`.
    json: jsonb().$type<unknown>(),
    // DM-061: JSON yang gagal validasi tetap disimpan (history/fallback korupsi), ditandai agar publish/restore menghindarinya.
    jsonInvalid: boolean().notNull().default(false),
    kind: documentSnapshotKindEnum().notNull(),
    label: text(),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamptz().notNull().defaultNow(),
  },
  (table) => [index("document_snapshots_document_id_created_at_idx").on(table.documentId, table.createdAt.desc())],
);
