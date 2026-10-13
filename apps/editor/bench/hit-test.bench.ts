import { expect, test } from "@playwright/test";

// T0.5.2 / AC ED-020: hit-test 2.000 node < 1 ms rata-rata. Angka headless WSL2 = indikatif.

type Spike = { hit: (x: number, y: number) => { nodeId: string } | null };

for (const isolation of ["shadow", "prefix"]) {
  test(`hit-test landing2000 · isolation=${isolation}`, async ({ page }) => {
    await page.goto(`?fixture=landing2000&isolation=${isolation}&zoom=0.25&x=20&y=20`);
    await expect(page.getByTestId("editor-viewport")).toBeVisible();
    await page.waitForTimeout(1000);

    const page_ = await page.locator('[data-node-id="pg_bench00001"]').boundingBox();
    if (!page_) throw new Error("page tidak terlihat");
    const area = {
      left: Math.max(page_.x, 0),
      top: Math.max(page_.y, 0),
      right: Math.min(page_.x + page_.width, 1280),
      bottom: Math.min(page_.y + page_.height, 800),
    };

    const result = await page.evaluate((bounds) => {
      const spike = (window as unknown as { __spike: Spike }).__spike;
      // Titik acak deterministik (LCG) di area page yang terlihat.
      let seed = 42;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };
      const points = Array.from({ length: 2000 }, () => ({
        x: bounds.left + random() * (bounds.right - bounds.left),
        y: bounds.top + random() * (bounds.bottom - bounds.top),
      }));
      for (const point of points.slice(0, 100)) spike.hit(point.x, point.y); // pemanasan
      // Diukur total lalu dibagi: resolusi performance.now() dibulatkan browser (~0,1 ms).
      let hits = 0;
      const start = performance.now();
      for (const point of points) if (spike.hit(point.x, point.y)) hits++;
      const total = performance.now() - start;
      return { average: total / points.length, total, hits };
    }, area);

    console.log(
      `isolation=${isolation}: rata-rata ${result.average.toFixed(4)} ms (total ${result.total.toFixed(1)} ms), ${result.hits}/2000 titik mengenai node`,
    );
    expect(result.average).toBeLessThan(1);
  });
}
