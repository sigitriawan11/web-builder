import { boolean, index, inet, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { id } from "../columns";
import { users } from "./identity";
import { workspaces } from "./workspaces";

// Bukti persetujuan (spec 08 §20 `consents`, ACC-001, ACC-313): satu baris per persetujuan/penarikan, tidak
// pernah diubah — perubahan = baris baru (`granted=false` untuk menarik consent marketing).
export const consentTypeEnum = pgEnum("consent_type", ["terms", "privacy", "marketing", "dpa", "aup"]);

export const consents = pgTable(
  "consents",
  {
    id: id(),
    // Null untuk consent level workspace (mis. DPA) atau setelah user dihapus (bukti tetap tersimpan).
    userId: uuid().references(() => users.id, { onDelete: "set null" }),
    workspaceId: uuid().references(() => workspaces.id, { onDelete: "set null" }),
    type: consentTypeEnum().notNull(),
    version: text().notNull(),
    granted: boolean().notNull(),
    ip: inet(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("consents_user_id_idx").on(table.userId), index("consents_workspace_id_idx").on(table.workspaceId)],
);
