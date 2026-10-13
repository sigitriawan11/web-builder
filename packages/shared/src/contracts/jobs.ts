import { z } from "zod";
import { UuidV7Schema } from "../ids";

// Payload job BullMQ (ARCHITECTURE §5.4): divalidasi saat enqueue (api) dan saat diproses (worker).
// Job hanya membawa ID, bukan data besar; setiap job membawa `requestId` asal untuk propagasi log.

export const QUEUE_NAMES = [
  "publish",
  "thumbnails",
  "ai-runs",
  "workflow-exec",
  "email",
  "whatsapp",
  "image-processing",
  "domains",
  "payments",
  "cleanup",
  "dead-letter",
] as const;
export const QueueNameSchema = z.enum(QUEUE_NAMES);
export type QueueName = z.infer<typeof QueueNameSchema>;

const jobBase = { requestId: z.string().min(1) };

// Payload per queue; queue lain ditambahkan saat processor-nya dibangun.
export const JOB_PAYLOADS = {
  // Idempoten per deploymentId.
  publish: z.object({ ...jobBase, siteId: UuidV7Schema, deploymentId: UuidV7Schema }),
  // Dedupe dengan jobId `thumb:<documentId>:<snapshotId>`.
  thumbnails: z.object({ ...jobBase, documentId: UuidV7Schema, snapshotId: UuidV7Schema }),
  // Email transaksional (ACC-271): hanya template + penerima; worker merender isi dalam bahasa user (T1.13.2).
  // Template lain (verifikasi, reset, selamat datang) ditambah bersama fiturnya (T1.5.3, T1.5.5, T1.5.13).
  email: z.object({ ...jobBase, template: z.enum(["account_exists"]), userId: UuidV7Schema }),
} satisfies Partial<Record<QueueName, z.ZodType>>;

export type JobPayload<Q extends keyof typeof JOB_PAYLOADS> = z.infer<(typeof JOB_PAYLOADS)[Q]>;

/** Validasi payload job; melempar ZodError bila tidak cocok (api: bug saat enqueue; worker: job → dead-letter). */
export function parseJobPayload<Q extends keyof typeof JOB_PAYLOADS>(queue: Q, payload: unknown): JobPayload<Q> {
  return JOB_PAYLOADS[queue].parse(payload) as JobPayload<Q>;
}

export function thumbnailJobId(documentId: string, snapshotId: string): string {
  return `thumb:${documentId}:${snapshotId}`;
}
