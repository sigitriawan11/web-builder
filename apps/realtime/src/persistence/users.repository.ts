import { type DbExecutor, eq, type SystemTenant, schema } from "@platform/db";

// Nama user untuk pesan lock ("Sedang diedit oleh …"); koneksi sudah terautentikasi token.
export async function findUserName(db: DbExecutor, _tenant: SystemTenant, userId: string): Promise<string | null> {
  const [user] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, userId));
  return user?.name ?? null;
}
