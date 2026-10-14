import { and, type Db, desc, eq, gt, ne, schema } from "@platform/db";

// Data akun milik user yang login. Bukan data tenant (workspace/site): selalu di-scope `userId` dari sesi.

export type ConsentRow = typeof schema.consents.$inferSelect;
export type NewConsent = typeof schema.consents.$inferInsert;

/** Semua consent user, terbaru dulu (baris tidak pernah diubah — perubahan = baris baru). */
export async function listUserConsents(db: Db, userId: string): Promise<ConsentRow[]> {
  return db
    .select()
    .from(schema.consents)
    .where(eq(schema.consents.userId, userId))
    .orderBy(desc(schema.consents.createdAt), desc(schema.consents.id));
}

export async function insertUserConsents(db: Db, rows: NewConsent[]): Promise<void> {
  if (rows.length > 0) await db.insert(schema.consents).values(rows);
}

export type SessionRow = Pick<
  typeof schema.sessions.$inferSelect,
  "id" | "token" | "ipAddress" | "userAgent" | "geo" | "createdAt" | "lastActiveAt" | "expiresAt"
>;

const sessionColumns = {
  id: schema.sessions.id,
  token: schema.sessions.token,
  ipAddress: schema.sessions.ipAddress,
  userAgent: schema.sessions.userAgent,
  geo: schema.sessions.geo,
  createdAt: schema.sessions.createdAt,
  lastActiveAt: schema.sessions.lastActiveAt,
  expiresAt: schema.sessions.expiresAt,
};

/** Sesi aktif user dari Postgres (sumber kebenaran; cache Redis BA tidak lengkap), terbaru aktif dulu. */
export async function listActiveSessions(db: Db, userId: string): Promise<SessionRow[]> {
  return db
    .select(sessionColumns)
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), gt(schema.sessions.expiresAt, new Date())))
    .orderBy(desc(schema.sessions.lastActiveAt), desc(schema.sessions.createdAt));
}

export async function findActiveSession(db: Db, userId: string, sessionId: string): Promise<SessionRow | undefined> {
  const [row] = await db
    .select(sessionColumns)
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.userId, userId),
        eq(schema.sessions.id, sessionId),
        gt(schema.sessions.expiresAt, new Date()),
      ),
    );
  return row;
}

export async function otherSessionTokens(db: Db, userId: string, currentSessionId: string): Promise<string[]> {
  const rows = await db
    .select({ token: schema.sessions.token })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), ne(schema.sessions.id, currentSessionId)));
  return rows.map((row) => row.token);
}
