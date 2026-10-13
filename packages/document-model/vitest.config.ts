import { vitestPreset } from "@platform/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  vitestPreset,
  defineConfig({
    test: {
      // T0.7.5 / DM-077: `pnpm bench` (Vitest bench), terpisah dari `pnpm test`.
      benchmark: { include: ["bench/**/*.bench.ts"] },
    },
  }),
);
