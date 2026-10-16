import { expect, test } from "@playwright/test";

// T2.3.5 / ED-022: switch page (1.000 node) < 500 ms. Angka WSL2/headless indikatif; ambang diukur di dalam.
// `PERF_ASSERT=1` membuat regresi berat gagal (dipakai `pnpm test:perf`/CI); tanpa itu hanya melaporkan.
const BUDGET_MS = 500;
const PERF_ASSERT = process.env.PERF_ASSERT === "1";

interface Spike {
  pages(): string[];
  setPage(id: string): void;
  doc: { getMap(key: string): { toJSON(): Record<string, { children?: string[] }> } };
}
declare global {
  interface Window {
    __spike: Spike;
  }
}

test("switch page 1.000 node < 500 ms", async ({ page }) => {
  await page.goto("?fixture=pages1000");
  await expect(page.locator("[data-node-id]").first()).toBeVisible();
  const [first, second] = await page.evaluate(() => window.__spike.pages());
  expect(second).toBeTruthy();

  const nodesOf = (id: string) =>
    page.evaluate((pageId) => {
      const nodes = window.__spike.doc.getMap("nodes").toJSON();
      let total = 0;
      const stack = [pageId];
      while (stack.length) {
        const node = nodes[stack.pop() as string];
        if (!node) continue;
        total++;
        if (node.children) stack.push(...node.children);
      }
      return total;
    }, id);
  expect(await nodesOf(second as string)).toBeGreaterThanOrEqual(900);

  const measure = async (target: string) => {
    const started = await page.evaluate((id) => {
      window.__spike.setPage(id);
      return performance.now();
    }, target);
    const expected = await nodesOf(target);
    await expect
      .poll(() => page.locator(`[data-node-id="${target}"] [data-node-id]`).count())
      .toBeGreaterThanOrEqual(expected - 1);
    return (await page.evaluate(() => performance.now())) - started;
  };

  // Hangatkan sekali (kompilasi JIT), lalu ukur switch bolak-balik.
  await measure(second as string);
  const back = await measure(first as string);
  const forward = await measure(second as string);
  const worst = Math.max(back, forward);
  test.info().annotations.push({
    type: "page-switch",
    description: `back=${back.toFixed(0)}ms forward=${forward.toFixed(0)}ms budget=${BUDGET_MS}ms`,
  });
  if (PERF_ASSERT) expect(worst).toBeLessThan(BUDGET_MS);
});
