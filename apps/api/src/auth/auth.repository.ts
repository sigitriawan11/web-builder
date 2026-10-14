import { and, type DbExecutor, eq, gt, ne, schema } from "@platform/db";

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

/**
 * Token sesi aktif milik user, kecuali `exceptToken`. Dibaca dari Postgres (sumber kebenaran): daftar sesi Better Auth
 * dengan secondary storage hanya membaca cache Redis yang kita batasi 5 menit, sehingga bisa tidak lengkap.
 */
export async function activeSessionTokens(
  executor: DbExecutor,
  userId: string,
  exceptToken?: string,
): Promise<string[]> {
  const rows = await executor
    .select({ token: schema.sessions.token })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        gt(schema.sessions.expiresAt, new Date()),
        exceptToken ? ne(schema.sessions.token, exceptToken) : undefined,
      ),
    );
  return rows.map((row) => row.token);
}
