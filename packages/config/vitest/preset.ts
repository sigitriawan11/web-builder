import { defineConfig } from "vitest/config";

// Preset Vitest bersama (ARCHITECTURE §4.2). Paket menggabungkannya dengan `mergeConfig(vitestPreset, …)`.
export const vitestPreset = defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    coverage: { provider: "v8", reporter: ["text", "json-summary"] },
  },
});
