import { defineConfig, devices } from "@playwright/test";

// E2E apps/web. Port & host terpisah dari `pnpm dev` (3000) agar tidak bentrok dengan dev server yang sedang dipakai.
// Host `*.localhost` di-resolve Chromium ke loopback, jadi host routing apex vs `app.` bisa diuji tanpa /etc/hosts.
const PORT = 3110;
export const APP_URL = `http://app.localhost:${PORT}`;
export const MARKETING_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: APP_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `next dev --port ${PORT}`,
    url: `${MARKETING_URL}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PUBLIC_APP_URL: APP_URL,
      PUBLIC_MARKETING_URL: MARKETING_URL,
      // Tidak dipanggil oleh test routing ini; tetap wajib valid.
      API_INTERNAL_URL: "http://127.0.0.1:4999",
      EDITOR_ORIGIN: "http://localhost:5999",
    },
  },
});
