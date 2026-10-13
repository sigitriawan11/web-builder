import { envField, parseEnv } from "@platform/shared/env";
import { z } from "zod";

// Env apps/api (ARCHITECTURE §15.4), divalidasi saat boot. Variabel ditambah seiring fitur (auth, Redis, S3, …).
export const apiEnvSchema = {
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  API_PORT: envField.port().default(4000),
  DATABASE_URL: envField.url(),
  DATABASE_POOL_MAX: envField.int().default(10),
};

export type ApiEnv = ReturnType<typeof loadApiEnv>;

export function loadApiEnv(source: Readonly<Record<string, string | undefined>> = process.env) {
  return parseEnv("api", apiEnvSchema, source);
}
