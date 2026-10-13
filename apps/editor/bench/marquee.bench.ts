import { expect, test } from "@playwright/test";

// T0.5.5 / AC ED-053: update marquee ≤ 4 ms per frame pada 2.000 node. Headless WSL2 = indikatif.

type Point = { x: number; y: number };
type Spike = { marqueeSelection(drag: { origin: Point; current: Point; scopeId: string | null }): string[] };

test("marquee landing2000: biaya hitung & frame time saat drag", async ({ page }) => {
  await page.goto("?fixture=landing2000&zoom=0.1&x=20&y=20");
  await expect(page.getByTestId("editor-viewport")).toBeVisible();
  await page.waitForTimeout(1000);

  const compute = await page.evaluate(() => {
    const spike = (window as unknown as { __spike: Spike }).__spike;
    const runs = 1000;
    let hits = 0;
    const start = performance.now();
    for (let i = 0; i < runs; i++) {
      hits = spike.marqueeSelection({ origin: { x: 300, y: 10 }, current: { x: 100, y: 10 + (i % 700) }, scopeId: null }).length;
    }
    return { averageMs: (performance.now() - start) / runs, lastHits: hits };
  });

  // Drag sungguhan dari kanan page ke kiri-bawah, sambil merekam jarak antar frame.
  await page.evaluate(() => {
    const deltas: number[] = [];
    (window as unknown as { __deltas: number[] }).__deltas = deltas;
    let last = performance.now();
    const tick = (now: number) => {
      deltas.push(now - last);
      last = now;
      if (deltas.length < 400) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(300, 10);
  await page.mouse.down();
  await page.mouse.move(60, 780, { steps: 120 });
  const selectedDuringDrag = await page.locator(".overlay-marquee-hit").count();
  await page.mouse.up();
  const deltas = await page.evaluate(() => (window as unknown as { __deltas: number[] }).__deltas.slice(1));
  const sorted = [...deltas].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;

  console.log(
    `marqueeSelection rata-rata ${compute.averageMs.toFixed(4)} ms (${compute.lastHits} section kena); ` +
      `drag: p95 frame ${p95.toFixed(1)} ms, ${selectedDuringDrag} highlight di akhir drag`,
  );
  expect(compute.averageMs).toBeLessThan(4);
});
