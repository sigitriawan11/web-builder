import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// E2E apps/web. Port & host terpisah dari `pnpm dev` (3000) agar tidak bentrok dengan dev server yang sedang dipakai.
// Host `*.localhost` di-resolve Chromium ke loopback, jadi host routing apex vs `app.` bisa diuji tanpa /etc/hosts.
// Stack e2e khusus (keputusan owner T1.14.4): api + worker sungguhan di atas database `platform_e2e` & Redis DB 5 —
// tidak menyentuh DB/Redis/dev server owner. Mailpit dipakai bersama (email unik per test).
const rootEnv = new URL("../../.env", import.meta.url).pathname;
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const PORT = 3110;
const API_PORT = 4310;
const WORKER_HEALTH_PORT = 4210;
const REALTIME_PORT = 4410;
// DSN Sentry palsu: browser dicegat `page.route`; error server Next ditangkap server penampung di test telemetri.
export const SENTRY_E2E_PORT = 4610;
export const SENTRY_E2E_ORIGIN = `http://127.0.0.1:${SENTRY_E2E_PORT}`;
const SENTRY_DSN = `http://e2ekey@127.0.0.1:${SENTRY_E2E_PORT}/1`;
export const REALTIME_URL = `ws://realtime.localhost:${REALTIME_PORT}`;
// Editor SUNGGUHAN (Vite dev, base /editor/) — port & HMR sendiri, terpisah dari `pnpm dev` (5173).
const EDITOR_PORT = 5998;
export const APP_URL = `http://app.localhost:${PORT}`;
export const MARKETING_URL = `http://localhost:${PORT}`;
export const MAILPIT_API = `http://localhost:${process.env.MAILPIT_UI_PORT ?? "8025"}/api/v1`;

function withPath(url: string | undefined, path: string, fallback: string): string {
  const parsed = new URL(url ?? fallback);
  parsed.pathname = path;
  return parsed.toString();
}
export const E2E_DATABASE_URL = withPath(process.env.DATABASE_URL_TEST, "/platform_e2e", "postgres://localhost:5433/x");
export const E2E_REDIS_URL = withPath(process.env.REDIS_URL, "/5", "redis://localhost:6379");

const stackEnv = {
  DATABASE_URL: E2E_DATABASE_URL,
  REDIS_URL: E2E_REDIS_URL,
  PUBLIC_APP_URL: APP_URL,
  APP_ENV: "local",
};
// Object storage (MinIO lokal) untuk upload aset e2e (T2.12.*). api & worker memakainya.
const s3Env = {
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  S3_REGION: "auto",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "minioadmin",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin",
  S3_BUCKET_UPLOADS: "uploads",
  S3_BUCKET_ASSETS: "assets",
  S3_FORCE_PATH_STYLE: "true",
};
const apiEnv = {
  ...stackEnv,
  ...s3Env,
  API_PORT: String(API_PORT),
  BETTER_AUTH_URL: `${APP_URL}/api/auth`,
  PUBLIC_REALTIME_URL: REALTIME_URL,
  LOG_LEVEL: "warn",
};
// Debounce flush pendek: test reload tidak perlu menunggu 2 s default.
const realtimeEnv = {
  ...stackEnv,
  REALTIME_PORT: String(REALTIME_PORT),
  REALTIME_FLUSH_DEBOUNCE_MS: "200",
  REALTIME_FLUSH_MAX_MS: "1000",
  LOG_LEVEL: "warn",
};
const workerEnv = {
  ...stackEnv,
  ...s3Env,
  WORKER_HEALTH_PORT: String(WORKER_HEALTH_PORT),
  WORKER_QUEUES: "email,dead-letter,image-processing",
  LOG_LEVEL: "warn",
};

export default defineConfig({
  testDir: "e2e",
  // T1.16.4: user owner terverifikasi + sesi login (setelah webServer siap).
  globalSetup: "./e2e/global-setup.ts",
  // Satu worker: semua test berbagi stack e2e yang sama (satu IP → rate limit registrasi 3/jam per IP, Redis e2e
  // yang direset antar test). Paralel lintas file membuat registrasi di file lain ikut menghabiskan kuota → flaky.
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: APP_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/stack/start-stack.mjs",
      url: `http://127.0.0.1:${API_PORT}/health/ready`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...(process.env as Record<string, string>),
        REDIS_URL: E2E_REDIS_URL,
        E2E_API_ENV: JSON.stringify(apiEnv),
        E2E_WORKER_ENV: JSON.stringify(workerEnv),
        E2E_REALTIME_ENV: JSON.stringify(realtimeEnv),
      },
    },
    {
      command: `next dev --port ${PORT}`,
      url: `${MARKETING_URL}/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...(process.env as Record<string, string>),
        PUBLIC_APP_URL: APP_URL,
        PUBLIC_MARKETING_URL: MARKETING_URL,
        API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}`,
        PUBLIC_REALTIME_URL: REALTIME_URL,
        NEXT_PUBLIC_SENTRY_DSN: SENTRY_DSN,
        NEXT_PUBLIC_SENTRY_ENVIRONMENT: "e2e",
        SENTRY_DSN,
        SENTRY_ENVIRONMENT: "e2e",
        EDITOR_ORIGIN: `http://localhost:${EDITOR_PORT}`,
        // Upload presigned ke MinIO (ED-160) — origin diizinkan di CSP connect-src.
        PUBLIC_UPLOAD_URL: s3Env.S3_ENDPOINT,
        APP_ENV: "local",
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
    {
      command: "pnpm --filter @platform/editor exec vite --strictPort",
      url: `http://localhost:${EDITOR_PORT}/editor/`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...(process.env as Record<string, string>),
        EDITOR_PORT: String(EDITOR_PORT),
        VITE_SENTRY_DSN: SENTRY_DSN,
        VITE_SENTRY_ENVIRONMENT: "e2e",
      },
    },
  ],
});
