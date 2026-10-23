import { type DbExecutor, eq, schema } from "@platform/db";

// SATU-SATUNYA tempat modul AI menyentuh tabel. Run AI = global (admin M3); scope tenant saat run user (M6).
const { aiRuns } = schema;

export type AiRunRow = typeof aiRuns.$inferSelect;
export type AiRunInsert = typeof aiRuns.$inferInsert;

export async function insertRun(exec: DbExecutor, values: AiRunInsert): Promise<string> {
  const [row] = await exec.insert(aiRuns).values(values).returning({ id: aiRuns.id });
  if (!row) throw new Error("insert ai_runs gagal");
  return row.id;
}

export async function findRun(exec: DbExecutor, id: string): Promise<AiRunRow | undefined> {
  const [row] = await exec.select().from(aiRuns).where(eq(aiRuns.id, id)).limit(1);
  return row;
}
