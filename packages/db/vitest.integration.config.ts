import { defineConfig } from "vitest/config";

// Integration test dengan Postgres asli (`pnpm test:integration`, butuh `pnpm infra:up`). ARCHITECTURE §14.
export default defineConfig({
  test: {
    include: ["src/**/*.int.test.ts", "test/**/*.int.test.ts"],
    globalSetup: ["./test/global-setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
