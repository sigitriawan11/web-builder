import { index, jsonb, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { identityId, timestamps } from "../columns";

// Audit log aksi sensitif (ARCHITECTURE §9.10, spec 08 ACC-212): append-only, retensi 2 tahun.
// Append-only ditegakkan di DB: role `platform_app` hanya SELECT/INSERT + trigger menolak UPDATE/DELETE
// (migration `0004_audit_append_only`). Sengaja TANPA foreign key: log tetap ada setelah user/workspace/situs
// dihapus, dan `actor_id` user yang menghapus akun diganti hash (spec 08 ACC-012) — karena itu bertipe text.

export const auditActorTypeEnum = pgEnum("audit_actor_type", ["user", "staff", "system", "ai"]);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: identityId(),
    actorType: auditActorTypeEnum().notNull(),
    actorId: text(),
    impersonatorId: text(),
    workspaceId: uuid(),
    siteId: uuid(),
    // `domain.verb`, mis. `site.publish`, `payment_config.update` (ARCHITECTURE §18).
    action: text().notNull(),
    targetType: text(),
    targetId: text(),
    before: jsonb(),
    after: jsonb(),
    reason: text(),
    ip: text(),
    userAgent: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index("audit_logs_workspace_id_created_at_idx").on(table.workspaceId, table.createdAt.desc()),
    index("audit_logs_site_id_created_at_idx").on(table.siteId, table.createdAt.desc()),
    index("audit_logs_target_idx").on(table.targetType, table.targetId),
    index("audit_logs_actor_id_created_at_idx").on(table.actorId, table.createdAt),
  ],
);
