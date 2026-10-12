import { defineConfig, devices } from "@playwright/test";

// Port terpisah dari `pnpm dev` (5173) agar e2e tidak bentrok dengan dev server yang sedang dipakai.
const PORT = 5180;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}/editor/`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/editor/`,
    reuseExistingServer: false,
  },
});
