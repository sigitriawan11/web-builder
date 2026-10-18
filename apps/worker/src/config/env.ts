import { QUEUE_NAMES, type QueueName } from "@platform/shared/contracts";
import { EnvError, envField, parseEnv, telemetryEnvSchema } from "@platform/shared/env";
import { z } from "zod";

// Env apps/worker (ARCHITECTURE §5.4, §15.4), divalidasi saat boot. Variabel ditambah seiring processor.

/** `*` (atau kosong) = semua queue yang punya processor; selain itu daftar nama queue dipisah koma. */
const queueSelection = z
  .string()
  .default("*")
  .transform((value, ctx): "all" | QueueName[] => {
    const items = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (items.length === 0 || items.includes("*")) return "all";
    const unknown = items.filter((item) => !(QUEUE_NAMES as readonly string[]).includes(item));
    if (unknown.length > 0) {
      ctx.addIssue({ code: "custom", message: `queue tidak dikenal: ${unknown.join(", ")}` });
      return z.NEVER;
    }
    return [...new Set(items)] as QueueName[];
  });

export const workerEnvSchema = {
  ...telemetryEnvSchema,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  REDIS_URL: envField.url(),
  WORKER_QUEUES: queueSelection,
  // Health + Bull Board (lokal) — ARCHITECTURE §15.
  WORKER_HEALTH_PORT: envField.port().default(4200),
  DATABASE_URL: envField.url(),
  DATABASE_POOL_MAX: envField.int().default(5),
  // Jadwal queue `cleanup` (cron, zona Asia/Jakarta). Compaction dokumen: harian 03:00 (trafik rendah).
  CLEANUP_COMPACTION_CRON: z.string().min(9).default("0 3 * * *"),
  // Email (ACC-271): Mailpit lewat SMTP di lokal, Resend di production.
  EMAIL_PROVIDER: z.enum(["smtp", "resend"]).default("smtp"),
  SMTP_URL: envField.url().optional(),
  RESEND_API_KEY: envField.secret(8).optional(),
  EMAIL_FROM: envField.string(),
  EMAIL_REPLY_TO: envField.string().optional(),
  // Basis link di email (halaman web).
  PUBLIC_APP_URL: envField.url(),
  // Object storage S3-compatible (MinIO lokal / R2) — processor image-processing (ARCHITECTURE §9.9).
  S3_ENDPOINT: envField.url(),
  S3_REGION: envField.string().default("auto"),
  S3_ACCESS_KEY_ID: envField.string(),
  S3_SECRET_ACCESS_KEY: envField.secret(8),
  S3_BUCKET_UPLOADS: envField.string().default("uploads"),
  S3_BUCKET_ASSETS: envField.string().default("assets"),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
};

export type WorkerEnv = ReturnType<typeof loadWorkerEnv>;

export function loadWorkerEnv(source: Readonly<Record<string, string | undefined>> = process.env) {
  const env = parseEnv("worker", workerEnvSchema, source);
  // Syarat lintas variabel: kredensial provider yang dipilih wajib ada (gagal saat start, bukan saat job pertama).
  if (env.EMAIL_PROVIDER === "smtp" && !env.SMTP_URL)
    throw new EnvError("worker", [{ key: "SMTP_URL", message: "wajib diisi bila EMAIL_PROVIDER=smtp" }]);
  if (env.EMAIL_PROVIDER === "resend" && !env.RESEND_API_KEY)
    throw new EnvError("worker", [{ key: "RESEND_API_KEY", message: "wajib diisi bila EMAIL_PROVIDER=resend" }]);
  return env;
}
