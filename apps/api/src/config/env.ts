import { envField, parseEnv, telemetryEnvSchema } from "@platform/shared/env";
import { z } from "zod";

// Env apps/api (ARCHITECTURE §15.4), divalidasi saat boot. Variabel ditambah seiring fitur (auth, Redis, S3, …).
export const apiEnvSchema = {
  ...telemetryEnvSchema,
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "staging", "production"]),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  API_PORT: envField.port().default(4000),
  DATABASE_URL: envField.url(),
  DATABASE_POOL_MAX: envField.int().default(10),
  REDIS_URL: envField.url(),
  // Object storage S3-compatible (MinIO lokal / R2), ARCHITECTURE §15.4 & §9.9 (upload presigned).
  S3_ENDPOINT: envField.url(),
  S3_REGION: envField.string().default("auto"),
  S3_ACCESS_KEY_ID: envField.string(),
  S3_SECRET_ACCESS_KEY: envField.secret(8),
  // Bucket upload mentah (presigned PUT) & bucket asset publik (varian hasil proses).
  S3_BUCKET_UPLOADS: envField.string().default("uploads"),
  S3_BUCKET_ASSETS: envField.string().default("assets"),
  // MinIO lokal butuh path-style (bucket di path, bukan subdomain); R2 virtual-hosted.
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // JWT service-to-service (ARCHITECTURE §9.3).
  INTERNAL_JWT_SECRET: envField.secret(32),
  // Better Auth (ARCHITECTURE §9.1): URL publik auth = PUBLIC_APP_URL + /api/auth.
  BETTER_AUTH_SECRET: envField.secret(32),
  BETTER_AUTH_URL: envField.url(),
  PUBLIC_APP_URL: envField.url(),
  // Realtime (ARCHITECTURE §5.5): secret JWT token koneksi & URL WebSocket publik yang diberikan ke editor.
  REALTIME_TOKEN_SECRET: envField.secret(32),
  PUBLIC_REALTIME_URL: z.string().regex(/^wss?:\/\//, "harus URL WebSocket (ws:// atau wss://)"),
  // Login Google (ACC-002), opsional: keduanya diisi untuk mengaktifkan.
  GOOGLE_CLIENT_ID: envField.string().optional(),
  GOOGLE_CLIENT_SECRET: envField.secret(8).optional(),
  // Redirect URI terdaftar di Google Console; default `<BETTER_AUTH_URL>/callback/google`. Lokal: Google menolak
  // `*.localhost`, jadi dipakai `http://localhost:3000/...` yang diteruskan web ke `app.localhost` (T1.14.2).
  GOOGLE_REDIRECT_URI: envField.url().optional(),
  // Cloudflare Turnstile secret (ACC-004); lokal memakai secret uji yang selalu lolos.
  CAPTCHA_SECRET: envField.secret(16),
};

export type ApiEnv = ReturnType<typeof loadApiEnv>;

export function loadApiEnv(source: Readonly<Record<string, string | undefined>> = process.env) {
  return parseEnv("api", apiEnvSchema, source);
}
