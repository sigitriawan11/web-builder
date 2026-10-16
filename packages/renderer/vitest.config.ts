import { vitestPreset } from "@platform/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  vitestPreset,
  defineConfig({
    // ARCHITECTURE §14: target coverage renderer ≥ 80% (statement & baris), ditegakkan `pnpm test:coverage` (CI).
    test: { coverage: { include: ["src/**"], thresholds: { statements: 80, lines: 80 } } },
  }),
);
