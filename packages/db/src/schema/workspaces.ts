import { sql } from "drizzle-orm";
import { index, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, softDelete, timestamps } from "../columns";
import { users } from "./identity";

// Workspace & keanggotaan (spec 08 ACC-030, ACC-370; ARCHITECTURE §6.3). M1: hanya personal workspace.
// Paket TIDAK disimpan di sini: paket efektif diturunkan dari `subscriptions` (M5), tanpa langganan = free.
// Kolom fase lanjut (`balance_idr`, `billing_profile`) ditambah saat billing (M5).

const timestamptz = () => timestamp({ withTimezone: true });

export const workspaceTypeEnum = pgEnum("workspace_type", ["personal", "team"]);
export const workspaceStatusEnum = pgEnum("workspace_status", ["active", "read_only", "suspended", "deleted"]);
// spec 08 ACC-033: role tetap; sama dengan WorkspaceRoleSchema di @platform/shared/contracts.
export const workspaceRoleEnum = pgEnum("workspace_role", ["owner", "admin", "editor", "viewer", "billing"]);
export const invitationStatusEnum = pgEnum("invitation_status", ["pending", "accepted", "revoked", "expired"]);

export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    // Untuk URL dashboard `/w/{slug}` (ACC-030): personal = `ws_` + 10 karakter acak; bukan PK agar bisa diganti.
    slug: text().notNull().unique(),
    type: workspaceTypeEnum().notNull(),
    name: text().notNull(),
    logoUrl: text(),
    // Denormalisasi untuk query cepat; sumber kebenaran role tetap `workspace_members`.
    ownerUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: workspaceStatusEnum().notNull().default("active"),
    ...timestamps,
    ...softDelete,
  },
  (table) => [
    index("workspaces_owner_user_id_idx").on(table.ownerUserId),
    // Satu personal workspace per user (spec 08 ACC-370).
    uniqueIndex("workspaces_one_personal_per_owner_key").on(table.ownerUserId).where(sql`${table.type} = 'personal'`),
  ],
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum().notNull(),
    invitedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    joinedAt: timestamptz().notNull().defaultNow(),
    updatedAt: timestamps.updatedAt,
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    // "Workspace saya": cari keanggotaan per user.
    index("workspace_members_user_id_idx").on(table.userId),
    // Tepat satu owner per workspace (spec 08 ACC-033).
    uniqueIndex("workspace_members_one_owner_key").on(table.workspaceId).where(sql`${table.role} = 'owner'`),
  ],
);

// Undangan anggota tim (ACC-032, M9) — tabel dibuat sekarang agar skema keanggotaan lengkap; belum dipakai di M1.
export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: id(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: workspaceRoleEnum().notNull(),
    // Hanya hash token yang disimpan; token asli hanya ada di email undangan.
    tokenHash: text().notNull().unique("workspace_invitations_token_hash_key"),
    invitedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    status: invitationStatusEnum().notNull().default("pending"),
    expiresAt: timestamptz().notNull(),
    acceptedUserId: uuid().references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (table) => [index("workspace_invitations_workspace_id_idx").on(table.workspaceId)],
);
