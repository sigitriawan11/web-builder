import { defineConfig, devices } from "@playwright/test";

// Port terpisah dari `pnpm dev` (5173) agar e2e tidak bentrok dengan dev server yang sedang dipakai.
const PORT = 5180;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  // CI: 2 retry untuk meredam flakiness waktu (muat chunk lazy + render fixture besar saat runner terbebani); lokal 0.
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: `http://localhost:${PORT}/editor/`,
    trace: "retain-on-failure",
  },
  // WebKit (mesin Safari) butuh library sistem tambahan di WSL2 (`playwright install-deps webkit`, perlu sudo).
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: `vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/editor/`,
    reuseExistingServer: false,
  },
});
