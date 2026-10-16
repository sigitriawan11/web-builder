import { envField, parseEnv, telemetryEnvSchema } from "@platform/shared/env";
import { z } from "zod";

// Env apps/realtime (ARCHITECTURE §5.5, §15.4), divalidasi saat boot. Variabel ditambah seiring extension.
export const realtimeEnvSchema = {
  ...telemetryEnvSchema,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  REALTIME_PORT: envField.port().default(4100),
  // Lokal: semua interface agar `realtime.localhost` dari browser Windows (WSL2) bisa terhubung.
  REALTIME_HOST: z.string().min(1).default("0.0.0.0"),
  // Sama dengan api (penandatangan token koneksi, `POST /v1/realtime/token`).
  REALTIME_TOKEN_SECRET: envField.secret(32),
  DATABASE_URL: envField.url(),
  // Single-editor lock `doclock:<docId>` (ARCHITECTURE §5.5).
  REDIS_URL: envField.url(),
  // JWT service-to-service (worker/api → `/internal/*`, ARCHITECTURE §9.3); sama dengan api & worker.
  INTERNAL_JWT_SECRET: envField.secret(32),
  DATABASE_POOL_MAX: envField.int().default(5),
  // ARCHITECTURE §7.2: update klien di-buffer lalu ditulis sebagai satu baris (debounce, maksimum sejak update pertama).
  REALTIME_FLUSH_DEBOUNCE_MS: envField.int().default(2000),
  REALTIME_FLUSH_MAX_MS: envField.int().default(10_000),
  // Snapshot `auto` tiap ≥ N update klien atau ≥ interval sejak snapshot terakhir.
  REALTIME_SNAPSHOT_EVERY: envField.int().default(500),
  REALTIME_SNAPSHOT_INTERVAL_MS: envField.int().default(600_000),
};

export type RealtimeEnv = ReturnType<typeof loadRealtimeEnv>;

export function loadRealtimeEnv(source: Readonly<Record<string, string | undefined>> = process.env) {
  return parseEnv("realtime", realtimeEnvSchema, source);
}
