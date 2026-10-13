import { QUEUE_NAMES, type QueueName } from "@platform/shared/contracts";
import { envField, parseEnv } from "@platform/shared/env";
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
};

export type WorkerEnv = ReturnType<typeof loadWorkerEnv>;

export function loadWorkerEnv(source: Readonly<Record<string, string | undefined>> = process.env) {
  return parseEnv("worker", workerEnvSchema, source);
}
