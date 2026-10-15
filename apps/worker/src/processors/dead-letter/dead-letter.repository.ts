import { type Db, schema } from "@platform/db";
import type { JobPayload } from "@platform/shared/contracts";

// Dead-letter = data operasional platform (bukan data tenant) → tanpa scope workspace/site.

export async function insertDeadLetterJob(db: Db, entry: JobPayload<"dead-letter">): Promise<string> {
  const [row] = await db
    .insert(schema.deadLetterJobs)
    .values({
      queue: entry.sourceQueue,
      jobId: entry.jobId,
      jobName: entry.jobName,
      payload: entry.payload,
      error: entry.error,
      attempts: entry.attempts,
      requestId: entry.requestId,
      failedAt: new Date(entry.failedAt),
    })
    .returning({ id: schema.deadLetterJobs.id });
  if (!row) throw new Error("insert dead_letter_jobs gagal");
  return row.id;
}
