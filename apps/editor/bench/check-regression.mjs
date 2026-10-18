#!/usr/bin/env node
// T2.18.4 / ED-241: bandingkan ringkasan benchmark (BENCH_JSON) dengan baseline; gagal (exit 1) bila ada metrik
// yang regresi > ambang (default 20%). `.fps` makin tinggi makin baik; `.ms` makin rendah makin baik.
// Pemakaian: node check-regression.mjs --current <f> --baseline <f> [--threshold 0.2] [--report <md>]
import { readFileSync, writeFileSync } from "node:fs";

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const currentPath = arg("--current");
const baselinePath = arg("--baseline");
const threshold = Number(arg("--threshold", "0.2"));
const reportPath = arg("--report");

if (!currentPath) {
  console.error("check-regression: --current wajib");
  process.exit(2);
}
const current = JSON.parse(readFileSync(currentPath, "utf8"));

let baseline;
try {
  baseline = baselinePath ? JSON.parse(readFileSync(baselinePath, "utf8")) : null;
} catch {
  baseline = null;
}
if (!baseline?.metrics) {
  console.log("check-regression: tidak ada baseline — lewati perbandingan (seed baseline dari run ini).");
  process.exit(0);
}

const pct = (base, cur) => (base === 0 ? 0 : ((cur - base) / base) * 100);
const rows = [];
let regressed = 0;

for (const [key, baseValue] of Object.entries(baseline.metrics)) {
  const curValue = current.metrics?.[key];
  if (typeof curValue !== "number" || typeof baseValue !== "number") continue;
  const higherIsBetter = key.endsWith(".fps");
  const delta = pct(baseValue, curValue); // + = naik
  // Regresi: fps turun > ambang, atau ms naik > ambang.
  const isRegression = higherIsBetter ? delta < -threshold * 100 : delta > threshold * 100;
  if (isRegression) regressed++;
  rows.push({ key, base: baseValue, cur: curValue, delta, regression: isRegression });
}

rows.sort((a, b) => (a.regression === b.regression ? a.delta - b.delta : a.regression ? -1 : 1));

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const lines = [
  `## Benchmark canvas — regresi ${threshold * 100}% (ED-241)`,
  "",
  `${regressed > 0 ? `⚠️ **${regressed} metrik regresi**` : "✅ Tidak ada regresi"} (baseline ${baseline.date ?? "?"} → sekarang ${current.date ?? "?"})`,
  "",
  "| Metrik | Baseline | Sekarang | Δ | Status |",
  "| --- | ---: | ---: | ---: | :---: |",
  ...rows.map(
    (r) =>
      `| ${r.key} | ${fmt(r.base)} | ${fmt(r.cur)} | ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)}% | ${r.regression ? "🔴" : "🟢"} |`,
  ),
];
const report = lines.join("\n");
console.log(report);
if (reportPath) writeFileSync(reportPath, `${report}\n`);

process.exit(regressed > 0 ? 1 : 0);
