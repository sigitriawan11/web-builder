import { type DbExecutor, schema } from "@platform/db";

// Penulis audit log (ARCHITECTURE §9.10): append-only — hanya INSERT (role platform_app tidak bisa UPDATE/DELETE).
export type AuditEntry = typeof schema.auditLogs.$inferInsert;

export async function recordAudit(executor: DbExecutor, entry: AuditEntry): Promise<void> {
  await executor.insert(schema.auditLogs).values(entry);
}
