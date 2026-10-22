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

// Tugas queue `cleanup` (ARCHITECTURE §5.4, §7.4) — dijadwalkan worker (repeatable). Aset yatim, deployment lama &
// sesi kedaluwarsa ditambah bersama fiturnya.
export const CLEANUP_TASKS = ["compact-documents"] as const;
export type CleanupTask = (typeof CLEANUP_TASKS)[number];

// Payload per queue; queue lain ditambahkan saat processor-nya dibangun.
export const JOB_PAYLOADS = {
  // Idempoten per deploymentId.
  publish: z.object({ ...jobBase, siteId: UuidV7Schema, deploymentId: UuidV7Schema }),
  // Thumbnail render (CMP-014). `component` = versi library (dedupe `thumb:component:<id>`); `document` = snapshot
  // page situs (M4, dedupe `thumb:<documentId>:<snapshotId>`). Discriminated agar processor memilih sumber definisi.
  thumbnails: z.discriminatedUnion("target", [
    z.object({ ...jobBase, target: z.literal("component"), componentVersionId: UuidV7Schema }),
    z.object({ ...jobBase, target: z.literal("document"), documentId: UuidV7Schema, snapshotId: UuidV7Schema }),
  ]),
  // Pemrosesan gambar setelah upload (ARCHITECTURE §9.9): cek magic bytes, strip EXIF, varian, blurhash, sha256 →
  // status ready/rejected. `assetId` = ID dokumen (`ast_…`); worker membaca storageKey/workspace dari tabel `assets`.
  "image-processing": z.object({ ...jobBase, assetId: z.string().regex(/^ast_[0-9a-z]{6,24}$/) }),
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
      // Kode 6 digit untuk user yang membuka email di perangkat lain (ACC-003). Tidak ada untuk ganti email
      // (kode OTP terikat alamat yang sudah tersimpan).
      code: z
        .string()
        .regex(/^\d{6}$/)
        .optional(),
      // Penerima bila bukan email tersimpan: ganti email (ACC-008) memverifikasi alamat BARU.
      email: z.email().optional(),
    }),
    z.object({ ...jobBase, template: z.literal("auth.password_reset"), userId: UuidV7Schema, resetUrl: z.url() }),
    z.object({ ...jobBase, template: z.literal("auth.password_changed"), userId: UuidV7Schema }),
  ]),
  cleanup: z.object({ ...jobBase, task: z.enum(CLEANUP_TASKS) }),
  // Job yang gagal final di queue lain (ARCHITECTURE §5.4). `payload` sudah disensor (`redactJobPayload`); worker
  // `dead-letter` menyimpannya ke tabel `dead_letter_jobs` + alert.
  "dead-letter": z.object({
    ...jobBase,
    sourceQueue: QueueNameSchema.exclude(["dead-letter"]),
    jobId: z.string().min(1),
    jobName: z.string(),
    payload: z.unknown(),
    error: z.object({ message: z.string(), stack: z.string().optional() }),
    attempts: z.number().int().nonnegative(),
    failedAt: z.iso.datetime(),
  }),
} satisfies Partial<Record<QueueName, z.ZodType>>;

export type JobPayload<Q extends keyof typeof JOB_PAYLOADS> = z.infer<(typeof JOB_PAYLOADS)[Q]>;

/** Validasi payload job; melempar ZodError bila tidak cocok (api: bug saat enqueue; worker: job → dead-letter). */
export function parseJobPayload<Q extends keyof typeof JOB_PAYLOADS>(queue: Q, payload: unknown): JobPayload<Q> {
  return JOB_PAYLOADS[queue].parse(payload) as JobPayload<Q>;
}

export function thumbnailJobId(documentId: string, snapshotId: string): string {
  return `thumb:${documentId}:${snapshotId}`;
}

/** Dedupe thumbnail versi component (CMP-014): satu job per versi. */
export function componentThumbnailJobId(componentVersionId: string): string {
  return `thumb:component:${componentVersionId}`;
}

// Field payload berisi URL bertoken (Better Auth) — tidak boleh tersimpan utuh di DLQ (keputusan owner T1.13.3).
const REDACTED_PAYLOAD_KEYS = new Set(["verifyUrl", "resetUrl"]);
export const REDACTED = "[redacted]";

/** Salinan payload dengan field rahasia diganti `[redacted]` (rekursif); nilai non-objek dikembalikan apa adanya. */
export function redactJobPayload(payload: unknown): unknown {
  if (Array.isArray(payload)) return payload.map(redactJobPayload);
  if (payload === null || typeof payload !== "object") return payload;
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      REDACTED_PAYLOAD_KEYS.has(key) ? REDACTED : redactJobPayload(value),
    ]),
  );
}
