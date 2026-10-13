import { vitestPreset } from "@platform/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

// Unit test saja; `*.int.test.ts` butuh Postgres dan dijalankan `pnpm test:integration`.
export default mergeConfig(
  vitestPreset,
  defineConfig({ test: { exclude: ["**/*.int.test.ts", "**/node_modules/**"] } }),
);
