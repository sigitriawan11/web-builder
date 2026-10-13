import { defineConfig } from "vitest/config";

// Integration test worker dengan Redis, Postgres & Mailpit asli (`pnpm test:integration`, butuh `pnpm infra:up`).
export default defineConfig({
  test: {
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
