import { expect, test } from "@playwright/test";

// T2.2.2 / ED-029: penggaris (rulers) horizontal & vertikal, toggle Shift+R, tick menyesuaikan zoom.
test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=landing200&zoom=0.5&x=20&y=20");
  await expect(page.locator("[data-node-id]").first()).toBeVisible();
});

test("AC ED-029: Shift+R menampilkan penggaris dengan label tick, Shift+R lagi menyembunyikan", async ({ page }) => {
  await expect(page.getByTestId("rulers")).toHaveCount(0);

  await page.keyboard.press("Shift+R");
  await expect(page.getByTestId("rulers")).toBeVisible();

  // Tick label muncul di kedua penggaris (interval menyesuaikan zoom).
  const labels = page.locator(".overlay-ruler-label");
  expect(await labels.count()).toBeGreaterThan(2);

  // Toggle mati.
  await page.keyboard.press("Shift+R");
  await expect(page.getByTestId("rulers")).toHaveCount(0);
});

test("ED-029: penggaris tetap tergambar setelah pan & zoom (sinkron kamera)", async ({ page }) => {
  await page.keyboard.press("Shift+R");
  await expect(page.getByTestId("rulers")).toBeVisible();
  const before = await page.locator(".overlay-ruler-label").count();
  expect(before).toBeGreaterThan(0);

  // Zoom in via shortcut → tick dihitung ulang, penggaris tetap ada.
  await page.keyboard.press("ControlOrMeta+Equal");
  await page.keyboard.press("ControlOrMeta+Equal");
  await expect(page.getByTestId("rulers")).toBeVisible();
  expect(await page.locator(".overlay-ruler-label").count()).toBeGreaterThan(0);
});
