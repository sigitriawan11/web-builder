import { vitestPreset } from "@platform/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

// Unit test (tanpa infra): `*.int.test.ts` dijalankan `pnpm test:integration`.
export default mergeConfig(
  vitestPreset,
  defineConfig({ test: { exclude: ["**/*.int.test.ts", "**/node_modules/**"] } }),
);
