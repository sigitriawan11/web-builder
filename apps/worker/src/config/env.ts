import { QUEUE_NAMES, type QueueName } from "@platform/shared/contracts";
import { EnvError, envField, parseEnv } from "@platform/shared/env";
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
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  REDIS_URL: envField.url(),
  WORKER_QUEUES: queueSelection,
  // Health + Bull Board (lokal) — ARCHITECTURE §15.
  WORKER_HEALTH_PORT: envField.port().default(4200),
  DATABASE_URL: envField.url(),
  DATABASE_POOL_MAX: envField.int().default(5),
  // Email (ACC-271): Mailpit lewat SMTP di lokal, Resend di production.
  EMAIL_PROVIDER: z.enum(["smtp", "resend"]).default("smtp"),
  SMTP_URL: envField.url().optional(),
  RESEND_API_KEY: envField.secret(8).optional(),
  EMAIL_FROM: envField.string(),
  EMAIL_REPLY_TO: envField.string().optional(),
  // Basis link di email (halaman web).
  PUBLIC_APP_URL: envField.url(),
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
