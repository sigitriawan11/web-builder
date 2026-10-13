import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // T0.7.5 / DM-077: `pnpm bench` (Vitest bench), terpisah dari `pnpm test`.
    benchmark: { include: ["bench/**/*.bench.ts"] },
  },
});
