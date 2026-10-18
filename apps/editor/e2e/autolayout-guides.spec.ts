import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator } from "./doc-helpers";

// T2.8.13 / ED-096: helper auto-layout di canvas. Frame flex terseleksi → handle gap; drag mengubah nilai gap dgn
// snap ke token `space.*` terdekat (default theme: space.N = N×4px, jadi 32px = space.8).
// Row auto-layout (justify start, gap 16) — gap langsung dari layout.gap (kolom fixture pakai spaceBetween).
const ROW = "n_alrow00001";
const CHILD_A = "n_alrowfix01";
const CHILD_B = "n_alrowfil01";

const select = (page: Page, id: string) =>
  page.evaluate(
    (nid) =>
      (window as unknown as { __spike: { selection: { getState(): { select(i: string[]): void } } } }).__spike.selection
        .getState()
        .select([nid]),
    id,
  );

// Jarak horizontal antara dua anak pertama (gap ter-render).
async function childGap(page: Page): Promise<number> {
  const a = await boxOf(nodeLocator(page, CHILD_A));
  const b = await boxOf(nodeLocator(page, CHILD_B));
  return b.x - (a.x + a.width);
}

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=autolayout&zoom=1&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  await expect(nodeLocator(page, ROW)).toBeVisible();
});

test("AC ED-096: handle gap muncul & drag mengubah gap dengan snap ke token", async ({ page }) => {
  await select(page, ROW);
  const handle = page.getByTestId("autolayout-gap-handle");
  await expect(handle).toBeVisible();
  expect(Math.round(await childGap(page))).toBe(16); // gap awal fixture

  // Seret handle ke kanan ~16px → gap ≈ 32 → snap ke token space.8 (32px).
  const box = await handle.boundingBox();
  if (!box) throw new Error("handle gap tidak terlihat");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 16, cy, { steps: 6 });
  await page.mouse.up();

  expect(Math.round(await childGap(page))).toBe(32);
});
