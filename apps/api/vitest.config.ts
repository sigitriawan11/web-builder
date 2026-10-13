import { vitestPreset } from "@platform/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  vitestPreset,
  defineConfig({ test: { exclude: ["**/*.int.test.ts", "**/node_modules/**"] } }),
);
