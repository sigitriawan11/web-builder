import { expect, type Page, test } from "@playwright/test";

// T2.2.3 / ED-031: Mod+F — cari layer di page aktif (nama/teks) → pilih node & zoom to selection.
const selection = (page: Page): Promise<string[]> =>
  page.evaluate(
    () =>
      (
        window as unknown as { __spike: { selection: { getState(): { selectedIds: string[] } } } }
      ).__spike.selection.getState().selectedIds,
  );

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=landing200&zoom=0.5&x=20&y=20");
  await expect(page.locator("[data-node-id]").first()).toBeVisible();
});

test("AC ED-031: Mod+F cari layer berdasarkan nama → pilih & tutup", async ({ page }) => {
  await expect(page.getByTestId("layer-search")).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+f");
  await expect(page.getByTestId("layer-search")).toBeVisible();

  await page.getByTestId("layer-search-input").fill("subtitle");
  const items = page.getByTestId("layer-search-item");
  expect(await items.count()).toBeGreaterThan(0);

  await page.keyboard.press("Enter");
  await expect(page.getByTestId("layer-search")).toHaveCount(0);
  expect((await selection(page)).length).toBeGreaterThan(0);
});

test("ED-031: query tak cocok → kosong; Escape menutup", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+f");
  await page.getByTestId("layer-search-input").fill("zzzz-tidak-ada-layer-ini");
  await expect(page.getByTestId("layer-search-item")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("layer-search")).toHaveCount(0);
});
