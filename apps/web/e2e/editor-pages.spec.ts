import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.3.1 / ED-032: Pages panel.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const rows = (page: Page) => page.getByTestId("page-row");
const pageOrderTitles = (page: Page) => rows(page).allInnerTexts();

test.beforeEach(async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Pages Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
});

async function rowActions(page: Page, title: string) {
  const row = rows(page).filter({ hasText: title });
  await row.hover();
  await row.getByTestId("page-actions").click();
}

test("AC ED-032: tambah, rename (double-click), duplikat, jadikan home, hapus — tercermin di dokumen & bisa di-undo", async ({
  page,
}) => {
  await page.getByTestId("page-add").click();
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page).nth(1)).toHaveText("Page 2");
  // Page baru langsung dibuka (URL & nama page di toolbar).
  await expect(page).toHaveURL(/[?&]page=pg_/);
  await expect(page.getByTestId("editor-page-name")).toHaveText("/ Page 2");

  await rows(page).nth(1).getByRole("button", { name: "Page 2", exact: true }).dblclick();
  await page.getByRole("textbox", { name: "Rename" }).fill("Tentang Kami");
  await page.keyboard.press("Enter");
  await expect(rows(page).nth(1)).toHaveText("Tentang Kami");

  await rowActions(page, "Tentang Kami");
  await page.getByRole("menuitem", { name: "Duplicate" }).click();
  expect(await pageOrderTitles(page)).toEqual(["Home", "Tentang Kami", "Tentang Kami (copy)"]);

  // Undo duplikat (satu langkah), redo.
  await page.getByTestId("editor-canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z");
  expect(await pageOrderTitles(page)).toEqual(["Home", "Tentang Kami"]);
  await page.keyboard.press("Control+Shift+z");
  await expect(rows(page)).toHaveCount(3);

  // Jadikan home: ikon home pindah; page home tidak bisa dihapus.
  await rowActions(page, "Tentang Kami (copy)");
  await page.getByRole("menuitem", { name: "Set as home" }).click();
  await expect(rows(page).filter({ hasText: "(copy)" }).getByLabel("Home")).toBeVisible();
  await rowActions(page, "Tentang Kami (copy)");
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeDisabled();
  await page.keyboard.press("Escape");

  // Hapus dengan konfirmasi; undo mengembalikan.
  await rowActions(page, "Home");
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByTestId("page-delete-dialog")).toContainText("Delete page “Home”?");
  await page.getByTestId("page-delete-dialog").getByRole("button", { name: "Delete" }).click();
  await expect(rows(page)).toHaveCount(2);
  await page.getByTestId("editor-canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+z");
  await expect(rows(page)).toHaveCount(3);
});

test("klik page → canvas berpindah dengan kamera terakhir page itu; reorder lewat keyboard", async ({ page }) => {
  await page.getByTestId("page-add").click();
  await expect(rows(page)).toHaveCount(2);
  const secondId = await rows(page).nth(1).getAttribute("data-page-id");
  await expect(page.getByTestId("editor-canvas").locator(`[data-node-id="${secondId}"]`)).toBeAttached();

  // Kamera per page diingat.
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 111, y: 22, zoom: 0.5 }));
  await rows(page).first().getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByTestId("editor-page-name")).toHaveText("/ Home");
  expect(await page.evaluate(() => window.__editorTestApi?.getCamera())).toEqual({ x: 0, y: 0, zoom: 1 });
  await rows(page).nth(1).getByRole("button", { name: "Page 2", exact: true }).click();
  expect(await page.evaluate(() => window.__editorTestApi?.getCamera())).toEqual({ x: 111, y: 22, zoom: 0.5 });

  // Reorder keyboard (dnd-kit): fokus baris, Space, panah atas, Space.
  // Tunggu tiap tahap (dnd-kit mengukur posisi asinkron sebelum menerima panah berikutnya).
  const second = rows(page).nth(1);
  await second.focus();
  await page.keyboard.press("Space");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  await page.keyboard.press("Space");
  await expect.poll(() => pageOrderTitles(page)).toEqual(["Page 2", "Home"]);
});
