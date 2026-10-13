import { defineConfig } from "vitest/config";

// ED-238: logika murni canvas (tanpa DOM/React) wajib ber-coverage ≥ 90%. Struktur folder mengikuti
// ARCHITECTURE §5.2 (canvas/, tools/, document/), bukan `src/core/**` seperti teks ED-238.
const PURE_LOGIC = [
  "src/canvas/geometry/coordinates.ts",
  "src/canvas/geometry/geometry-store.ts",
  "src/canvas/zoom-limits.ts",
  "src/canvas/interactions/pan.ts",
  "src/canvas/interactions/zoom.ts",
  "src/canvas/interactions/interaction-machine.ts",
  "src/canvas/interactions/browser-guards.ts",
  "src/canvas/drag/move.ts",
  "src/canvas/drag/resize.ts",
  "src/canvas/drag/reorder.ts",
  "src/canvas/overlay/selection-geometry.ts",
  "src/canvas/hit-test/hit-test.ts",
  "src/canvas/render-root/style-to-css.ts",
  "src/tools/tool-store.ts",
  "src/tools/select/selection-depth.ts",
  "src/tools/select/marquee.ts",
  "src/document/undo-controller.ts",
  "src/document/undo-shortcut.ts",
  "src/commands/is-editable-target.ts",
];

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: PURE_LOGIC,
      reporter: ["text", "json-summary"],
      // Per file: modul yang kurang teruji tidak bisa bersembunyi di balik rata-rata.
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90, perFile: true },
    },
  },
});
