import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Benchmark canvas (ED-022): dijalankan terpisah dari e2e, satu worker agar pengukuran tidak saling ganggu.
export default defineConfig({
  ...base,
  testDir: "bench",
  testMatch: "**/*.bench.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  projects: [{ name: "chromium", use: { browserName: "chromium", viewport: { width: 1280, height: 800 } } }],
});
