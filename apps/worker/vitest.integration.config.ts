import { defineConfig } from "vitest/config";

// Integration test worker dengan Redis asli (`pnpm test:integration`, butuh `pnpm infra:up`).
export default defineConfig({
  test: {
    include: ["src/**/*.int.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
