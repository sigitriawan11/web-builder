import { type JobPayload, type QueueName, redactJobPayload } from "@platform/shared/contracts";
import type { Job } from "bullmq";

// Kirim job yang gagal FINAL ke queue `dead-letter` (ARCHITECTURE §5.4). BullMQ hanya mengisi `finishedOn` saat
// job dipindah ke `failed` (tidak saat dijadwalkan retry) — dipakai sebagai penanda final, termasuk
// UnrecoverableError (payload rusak) yang tidak di-retry walau attempts > 1.

export const isFinalFailure = (job: Job) => typeof job.finishedOn === "number";

export function deadLetterEntry(
  queue: Exclude<QueueName, "dead-letter">,
  job: Job,
  error: Error,
  now: Date = new Date(),
): JobPayload<"dead-letter"> {
  const data: unknown = job.data;
  const requestId =
    data && typeof data === "object" && "requestId" in data && typeof data.requestId === "string" && data.requestId
      ? data.requestId
      : `dlq:${queue}:${job.id ?? "unknown"}`;
  return {
    requestId,
    sourceQueue: queue,
    jobId: job.id ?? "unknown",
    jobName: job.name,
    // URL bertoken disensor sebelum keluar dari queue asal (keputusan owner T1.13.3).
    payload: redactJobPayload(data),
    error: { message: error.message, ...(error.stack ? { stack: error.stack } : {}) },
    attempts: job.attemptsMade,
    failedAt: new Date(job.finishedOn ?? now.getTime()).toISOString(),
  };
}
