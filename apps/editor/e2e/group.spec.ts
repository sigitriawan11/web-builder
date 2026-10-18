import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator } from "./doc-helpers";

// T2.13.9 / ED-144/145: Mod+G mengelompokkan seleksi jadi node group; Mod+Shift+G membongkar. Posisi visual anak tetap.
const CARD = "n_fcard00001";
const IMAGE = "n_fimage0001";

type Spike = {
  doc: { getMap(n: string): { keys(): Iterable<string>; get(id: string): { get(k: string): unknown } } };
  selection: { getState(): { select(ids: string[]): void } };
};
const select = (page: Page, ids: string[]) =>
  page.evaluate((s) => (window as unknown as { __spike: Spike }).__spike.selection.getState().select(s), ids);
const groupCount = (page: Page) =>
  page.evaluate(() => {
    const nodes = (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes");
    let n = 0;
    for (const id of nodes.keys()) if (nodes.get(id).get("type") === "group") n++;
    return n;
  });

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=freeform&zoom=1&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  await expect(nodeLocator(page, CARD)).toBeVisible();
});

test("AC ED-144/145: group lalu ungroup tidak mengubah posisi visual children", async ({ page }) => {
  const a0 = await boxOf(nodeLocator(page, CARD));
  const b0 = await boxOf(nodeLocator(page, IMAGE));
  const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);

  await select(page, [CARD, IMAGE]);
  await page.keyboard.press("ControlOrMeta+g");
  expect(await groupCount(page)).toBe(1);

  // Posisi visual anak tetap setelah group.
  const a1 = await boxOf(nodeLocator(page, CARD));
  const b1 = await boxOf(nodeLocator(page, IMAGE));
  near(a1.x, a0.x);
  near(a1.y, a0.y);
  near(b1.x, b0.x);
  near(b1.y, b0.y);

  // Group masih terpilih → ungroup.
  await page.keyboard.press("ControlOrMeta+Shift+g");
  expect(await groupCount(page)).toBe(0);

  // Posisi visual anak tetap setelah ungroup.
  const a2 = await boxOf(nodeLocator(page, CARD));
  const b2 = await boxOf(nodeLocator(page, IMAGE));
  near(a2.x, a0.x);
  near(a2.y, a0.y);
  near(b2.x, b0.x);
  near(b2.y, b0.y);
});
