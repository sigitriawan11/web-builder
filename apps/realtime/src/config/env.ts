import { envField, parseEnv } from "@platform/shared/env";
import { z } from "zod";

// Env apps/realtime (ARCHITECTURE §5.5, §15.4), divalidasi saat boot. Variabel ditambah seiring extension.
export const realtimeEnvSchema = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  REALTIME_PORT: envField.port().default(4100),
  // Lokal: semua interface agar `realtime.localhost` dari browser Windows (WSL2) bisa terhubung.
  REALTIME_HOST: z.string().min(1).default("0.0.0.0"),
  // Sama dengan api (penandatangan token koneksi, `POST /v1/realtime/token`).
  REALTIME_TOKEN_SECRET: envField.secret(32),
};

export type RealtimeEnv = ReturnType<typeof loadRealtimeEnv>;

export function loadRealtimeEnv(source: Readonly<Record<string, string | undefined>> = process.env) {
  return parseEnv("realtime", realtimeEnvSchema, source);
}
