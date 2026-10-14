import { defineConfig } from "vitest/config";

// Integration test realtime dengan Postgres/Redis asli (`pnpm test:integration`, butuh `pnpm infra:up`).
export default defineConfig({
  // `passWithNoTests`: integration test realtime pertama datang bersama persistence (T1.12.2).
  test: { include: ["src/**/*.int.test.ts"], passWithNoTests: true, testTimeout: 20_000, hookTimeout: 30_000 },
});
