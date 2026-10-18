import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator } from "./doc-helpers";

// T2.6.5 / ED-067: resize multi-seleksi proporsional. Bounding box gabungan di-resize → tiap node diskalakan
// posisi & ukurannya relatif ke box. (Math: unit test scaleRectInGroup; di sini interaksi end-to-end.)
const CARD = "n_fcard00001";
const IMAGE = "n_fimage0001";

const select = (page: Page, ids: string[]) =>
  page.evaluate(
    (sel) =>
      (window as unknown as { __spike: { selection: { getState(): { select(i: string[]): void } } } }).__spike.selection
        .getState()
        .select(sel),
    ids,
  );

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=freeform&zoom=1&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  await expect(nodeLocator(page, CARD)).toBeVisible();
});

test("AC ED-067: resize bounding box gabungan → kedua node & jaraknya berskala proporsional", async ({ page }) => {
  await select(page, [CARD, IMAGE]);

  const a0 = await boxOf(nodeLocator(page, CARD));
  const b0 = await boxOf(nodeLocator(page, IMAGE));
  // Handle resize muncul untuk multi-seleksi (8 handle di bounding box gabungan).
  await expect(page.locator('.overlay-handle[data-handle="se"]')).toBeVisible();

  // Bounding box gabungan (screen).
  const left = Math.min(a0.x, b0.x);
  const top = Math.min(a0.y, b0.y);
  const right = Math.max(a0.x + a0.width, b0.x + b0.width);
  const bottom = Math.max(a0.y + a0.height, b0.y + b0.height);
  const gw = right - left;
  const gh = bottom - top;

  // Seret handle SE sejauh (gw, gh) → box gabungan ~2× (zoom 1: 1px screen = 1px world).
  await page.mouse.move(right, bottom);
  await page.mouse.down();
  await page.mouse.move(right + gw, bottom + gh, { steps: 8 });
  await page.mouse.up();

  const a1 = await boxOf(nodeLocator(page, CARD));
  const b1 = await boxOf(nodeLocator(page, IMAGE));
  const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(3);

  // Kedua node berukuran ~2×.
  near(a1.width, a0.width * 2);
  near(a1.height, a0.height * 2);
  near(b1.width, b0.width * 2);
  near(b1.height, b0.height * 2);
  // Jarak horizontal antar node ~2× (proporsional).
  near(b1.x - a1.x, (b0.x - a0.x) * 2);
});
