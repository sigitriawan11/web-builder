import { vitestPreset } from "@platform/config/vitest";

// Unit test apps/web (preset: `src/**/*.test.*`); `e2e/` milik Playwright (`pnpm test:e2e`).
export default vitestPreset;
