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

/**
 * Kebijakan per queue (ARCHITECTURE §5.4). `attempts`/`backoff` dipasang producer saat enqueue (opsi job BullMQ);
 * `concurrency`/`timeoutMs` dipakai worker. Satu sumber agar api & worker tidak berbeda pendapat.
 */
export interface QueuePolicy {
  concurrency: number;
  attempts: number;
  backoff?: { type: "exponential" | "fixed"; delayMs: number };
  timeoutMs: number;
}

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

export const QUEUE_POLICIES: Readonly<Record<QueueName, QueuePolicy>> = {
  publish: {
    concurrency: 2,
    attempts: 3,
    backoff: { type: "exponential", delayMs: 10 * SECOND },
    timeoutMs: 2 * MINUTE,
  },
  thumbnails: {
    concurrency: 2,
    attempts: 2,
    backoff: { type: "exponential", delayMs: 30 * SECOND },
    timeoutMs: MINUTE,
  },
  // Tanpa auto-retry: retry hanya di level panggilan Claude API.
  "ai-runs": { concurrency: 5, attempts: 1, timeoutMs: 10 * MINUTE },
  // Default; policy per step workflow menimpa (spec 05).
  "workflow-exec": {
    concurrency: 10,
    attempts: 3,
    backoff: { type: "exponential", delayMs: 5 * SECOND },
    timeoutMs: MINUTE,
  },
  email: {
    concurrency: 10,
    attempts: 5,
    backoff: { type: "exponential", delayMs: 30 * SECOND },
    timeoutMs: 30 * SECOND,
  },
  whatsapp: { concurrency: 5, attempts: 5, backoff: { type: "exponential", delayMs: MINUTE }, timeoutMs: 30 * SECOND },
  "image-processing": {
    concurrency: 4,
    attempts: 3,
    backoff: { type: "exponential", delayMs: 10 * SECOND },
    timeoutMs: MINUTE,
  },
  domains: { concurrency: 2, attempts: 20, backoff: { type: "fixed", delayMs: 5 * MINUTE }, timeoutMs: 30 * SECOND },
  payments: {
    concurrency: 5,
    attempts: 8,
    backoff: { type: "exponential", delayMs: 10 * SECOND },
    timeoutMs: 30 * SECOND,
  },
  cleanup: { concurrency: 1, attempts: 3, timeoutMs: 10 * MINUTE },
  "dead-letter": { concurrency: 1, attempts: 1, timeoutMs: 30 * SECOND },
};

const jobBase = { requestId: z.string().min(1) };

// Payload per queue; queue lain ditambahkan saat processor-nya dibangun.
export const JOB_PAYLOADS = {
  // Idempoten per deploymentId.
  publish: z.object({ ...jobBase, siteId: UuidV7Schema, deploymentId: UuidV7Schema }),
  // Dedupe dengan jobId `thumb:<documentId>:<snapshotId>`.
  thumbnails: z.object({ ...jobBase, documentId: UuidV7Schema, snapshotId: UuidV7Schema }),
  // Email transaksional (ACC-271): template (nama = type katalog ACC-270) + penerima; worker merender isi dalam
  // bahasa user. Pengecualian "hanya ID": URL bertoken dibuat Better Auth saat request dan tidak bisa dimuat ulang
  // worker, jadi ikut payload (token berumur pendek; payload tidak pernah dicatat ke log).
  email: z.discriminatedUnion("template", [
    z.object({ ...jobBase, template: z.literal("auth.welcome"), userId: UuidV7Schema }),
    z.object({ ...jobBase, template: z.literal("auth.account_exists"), userId: UuidV7Schema }),
    z.object({
      ...jobBase,
      template: z.literal("auth.verify_email"),
      userId: UuidV7Schema,
      verifyUrl: z.url(),
      // Kode 6 digit untuk user yang membuka email di perangkat lain (ACC-003).
      code: z.string().regex(/^\d{6}$/),
    }),
    z.object({ ...jobBase, template: z.literal("auth.password_reset"), userId: UuidV7Schema, resetUrl: z.url() }),
    z.object({ ...jobBase, template: z.literal("auth.password_changed"), userId: UuidV7Schema }),
  ]),
} satisfies Partial<Record<QueueName, z.ZodType>>;

export type JobPayload<Q extends keyof typeof JOB_PAYLOADS> = z.infer<(typeof JOB_PAYLOADS)[Q]>;

/** Validasi payload job; melempar ZodError bila tidak cocok (api: bug saat enqueue; worker: job → dead-letter). */
export function parseJobPayload<Q extends keyof typeof JOB_PAYLOADS>(queue: Q, payload: unknown): JobPayload<Q> {
  return JOB_PAYLOADS[queue].parse(payload) as JobPayload<Q>;
}

export function thumbnailJobId(documentId: string, snapshotId: string): string {
  return `thumb:${documentId}:${snapshotId}`;
}
