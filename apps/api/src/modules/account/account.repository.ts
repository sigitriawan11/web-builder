import { type Db, desc, eq, schema } from "@platform/db";

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
