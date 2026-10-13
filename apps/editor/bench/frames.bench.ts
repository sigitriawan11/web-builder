import { expect, type Page, test } from "@playwright/test";

// T0.4.6: fps pan & zoom untuk breakpoint frame opsi (a) class vs (b) iframe, 3 frame × landing 200 node.
// Angka di WSL2/headless hanya indikatif; pengukuran resmi di laptop referensi (T0.7.4).

const SCENARIOS = [
  { name: "1 frame (baseline)", query: "fixture=landing200" },
  { name: "3 frame · class", query: "fixture=landing200&frames=all&bpMode=class" },
  { name: "3 frame · iframe", query: "fixture=landing200&frames=all&bpMode=iframe" },
];
const DURATION_MS = 3000;

type CameraStore = { getState(): { setCamera(next: { x?: number; y?: number; zoom?: number }): void } };

// Menggerakkan kamera tiap animation frame selama `durationMs` dan merekam jarak antar frame.
async function measure(page: Page, motion: "pan" | "zoom") {
  return page.evaluate(
    ({ motion, durationMs }) =>
      new Promise<number[]>((resolve) => {
        const camera = (window as unknown as { __spike: { camera: CameraStore } }).__spike.camera.getState();
        const deltas: number[] = [];
        let start = 0;
        let last = 0;
        const step = (now: number) => {
          if (start === 0) start = last = now;
          else deltas.push(now - last);
          last = now;
          const t = (now - start) / durationMs;
          if (motion === "pan") camera.setCamera({ x: 20 - t * 1600, y: 20 - t * 400, zoom: 0.4 });
          else camera.setCamera({ x: 20, y: 20, zoom: 0.25 + 0.35 * Math.abs(Math.sin(t * Math.PI * 3)) });
          if (now - start < durationMs) requestAnimationFrame(step);
          else resolve(deltas);
        };
        requestAnimationFrame(step);
      }),
    { motion, durationMs: DURATION_MS },
  );
}

function summarize(deltas: number[]) {
  const sorted = [...deltas].sort((a, b) => a - b);
  const total = deltas.reduce((sum, delta) => sum + delta, 0);
  return {
    fps: Math.round((deltas.length / total) * 1000 * 10) / 10,
    p95Ms: Math.round((sorted[Math.floor(sorted.length * 0.95)] ?? 0) * 10) / 10,
    longFrames: deltas.filter((delta) => delta > 50).length,
  };
}

test("fps pan & zoom per mode breakpoint frame", async ({ page }) => {
  const rows: string[] = [];
  for (const scenario of SCENARIOS) {
    await page.goto(`?${scenario.query}&zoom=0.4&x=20&y=20`);
    await expect(page.locator(".bp-frame").first()).toBeAttached();
    await page.waitForTimeout(1000);
    const pan = summarize(await measure(page, "pan"));
    const zoom = summarize(await measure(page, "zoom"));
    rows.push(
      `| ${scenario.name} | ${pan.fps} | ${pan.p95Ms} | ${pan.longFrames} | ${zoom.fps} | ${zoom.p95Ms} | ${zoom.longFrames} |`,
    );
  }
  console.log(
    [
      "| Skenario | Pan fps | Pan p95 ms | Pan >50ms | Zoom fps | Zoom p95 ms | Zoom >50ms |",
      "|---|---|---|---|---|---|---|",
      ...rows,
    ].join("\n"),
  );
});
