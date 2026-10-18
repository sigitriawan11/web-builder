// ED-226 (AC): bundle AWAL editor < 600 KB gzip (di luar font). "Bundle awal" = chunk entry + yang di-modulepreload
// + stylesheet entry di index.html; sisanya (canvas, Tiptap, renderer, panel) di-code-split ke chunk rute.
// Jalankan setelah `pnpm --filter @platform/editor build`.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const BUDGET = 600 * 1024;

const html = readFileSync(join(DIST, "index.html"), "utf8");
// Aset yang dimuat segera: <script src>, <link modulepreload href>, <link stylesheet href>.
const assets = [...html.matchAll(/(?:src|href)="\/editor\/(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
const unique = [...new Set(assets)];

let total = 0;
const rows = unique
  .map((asset) => {
    const gzip = gzipSync(readFileSync(join(DIST, asset))).length;
    total += gzip;
    return { asset, gzip };
  })
  .sort((a, b) => b.gzip - a.gzip);

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
for (const { asset, gzip } of rows) console.log(`  ${kb(gzip).padStart(10)}  ${asset}`);
console.log(`  ${"─".repeat(10)}`);
console.log(`  ${kb(total).padStart(10)}  total awal (budget ${kb(BUDGET)})`);

if (total > BUDGET) {
  console.error(`\n✗ Bundle awal ${kb(total)} melebihi budget ${kb(BUDGET)} (ED-226). Code-split lebih banyak.`);
  process.exit(1);
}
console.log(`\n✓ Bundle awal ${kb(total)} di bawah budget ${kb(BUDGET)} (ED-226).`);
