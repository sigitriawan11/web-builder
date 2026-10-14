import { and, type DbExecutor, eq, gt, isNull, lt, ne, or, schema } from "@platform/db";

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

/** Tandai sesi aktif (ACC-007); hanya menulis bila nilai lama lebih tua dari `staleBefore` (hemat tulis). */
export async function touchSession(executor: DbExecutor, sessionId: string, staleBefore: Date): Promise<void> {
  await executor
    .update(schema.sessions)
    .set({ lastActiveAt: new Date() })
    .where(
      and(
        eq(schema.sessions.id, sessionId),
        or(isNull(schema.sessions.lastActiveAt), lt(schema.sessions.lastActiveAt, staleBefore)),
      ),
    );
}

/** Akun punya password (credential)? Menentukan cara re-auth (ACC-008) dan metode login yang tersisa. */
export async function hasCredentialAccount(executor: DbExecutor, userId: string): Promise<boolean> {
  const [row] = await executor
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.providerId, "credential")))
    .limit(1);
  return row !== undefined;
}

export async function findUserName(executor: DbExecutor, userId: string): Promise<string | undefined> {
  const [row] = await executor
    .select({ name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, userId));
  return row?.name;
}
