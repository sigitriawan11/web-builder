import { type DbExecutor, schema } from "@platform/db";

// Tabel yang dikelola Better Auth lewat drizzleAdapter (ARCHITECTURE §6.2: hanya repository yang mengimport tabel).
// Kunci = nama model Better Auth.
export const AUTH_TABLES = {
  user: schema.users,
  session: schema.sessions,
  account: schema.accounts,
  verification: schema.verifications,
};

export type NewConsent = typeof schema.consents.$inferInsert;

export async function insertConsents(executor: DbExecutor, rows: NewConsent[]): Promise<void> {
  if (rows.length > 0) await executor.insert(schema.consents).values(rows);
}
