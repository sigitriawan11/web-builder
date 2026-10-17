import { expect, test } from "@playwright/test";
import { idByName, nodeLocator, selectedIds } from "./doc-helpers";

// T2.15.3 / ED-004, ED-207: mode preview full-screen di dalam editor. Mod+Enter masuk/keluar, Esc keluar,
// switch device mengubah lebar iframe, dan seleksi tetap setelah keluar.

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=landing200&zoom=0.5&x=20&y=20");
  await expect(page.locator("[data-node-id]").first()).toBeVisible();
});

test("AC ED-004: Mod+Enter buka overlay preview + iframe, Esc tutup", async ({ page }) => {
  await expect(page.getByTestId("preview-overlay")).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("preview-overlay")).toBeVisible();
  await expect(page.getByTestId("preview-iframe")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("preview-overlay")).toHaveCount(0);
});

test("switch device mengubah lebar iframe", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+Enter");
  const iframe = page.getByTestId("preview-iframe");
  await expect(iframe).toBeVisible();

  const baseWidth = await iframe.evaluate((element) => element.getBoundingClientRect().width);

  await page.getByTestId("preview-device-mobile").click();
  await expect.poll(() => iframe.evaluate((element) => element.getBoundingClientRect().width)).toBeLessThan(baseWidth);

  await page.getByTestId("preview-device-base").click();
  await expect
    .poll(() => iframe.evaluate((element) => element.getBoundingClientRect().width))
    .toBeCloseTo(baseWidth, 0);
});

test("ED-207: seleksi tetap setelah keluar preview", async ({ page }) => {
  const heroId = await idByName(page, "Hero");
  await nodeLocator(page, heroId).click();
  expect(await selectedIds(page)).toEqual([heroId]);

  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page.getByTestId("preview-overlay")).toBeVisible();
  await page.getByTestId("preview-close").click();
  await expect(page.getByTestId("preview-overlay")).toHaveCount(0);

  expect(await selectedIds(page)).toEqual([heroId]);
});
