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
const EDITOR_FIXTURE_PORT = 5998;
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
const apiEnv = { ...stackEnv, API_PORT: String(API_PORT), BETTER_AUTH_URL: `${APP_URL}/api/auth`, LOG_LEVEL: "warn" };
const workerEnv = {
  ...stackEnv,
  WORKER_HEALTH_PORT: String(WORKER_HEALTH_PORT),
  WORKER_QUEUES: "email,dead-letter",
  LOG_LEVEL: "warn",
};

export default defineConfig({
  testDir: "e2e",
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
        EDITOR_ORIGIN: `http://127.0.0.1:${EDITOR_FIXTURE_PORT}`,
        APP_ENV: "local",
        NEXT_DIST_DIR: ".next-e2e",
      },
    },
    {
      command: `node e2e/fixtures/editor-origin.mjs ${EDITOR_FIXTURE_PORT}`,
      url: `http://127.0.0.1:${EDITOR_FIXTURE_PORT}/editor/`,
      reuseExistingServer: false,
    },
  ],
});
