import { expect, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { firstPageId, renamePage } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.1.1 / ED-006: toolbar atas editor.
test.use({ locale: "en-US", storageState: OWNER_STATE });

test.beforeEach(async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  const siteId = await createSiteViaApi(page, "Toolbar Test");
  await page.goto(`${APP_URL}/editor/${siteId}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
});

test("AC ED-006: semua tombol toolbar punya aria-label & tooltip; tooltip tool memuat shortcut", async ({ page }) => {
  const toolbar = page.getByTestId("editor-header");
  const buttons = toolbar.locator("button, a[href]");
  const count = await buttons.count();
  expect(count).toBeGreaterThan(15);
  for (let index = 0; index < count; index++) {
    const button = buttons.nth(index);
    const label = (await button.getAttribute("aria-label")) ?? "";
    expect(label, `tombol #${index} tanpa aria-label`).not.toBe("");
    const tooltip = await button.evaluate(
      (element) =>
        element.closest("[data-tooltip]")?.getAttribute("data-tooltip") ??
        element.querySelector("[data-tooltip]")?.getAttribute("data-tooltip") ??
        null,
    );
    expect(tooltip, `tombol "${label}" tanpa tooltip`).toBeTruthy();
  }
  // Tooltip sungguhan muncul saat hover, dengan nama + shortcut.
  await page.getByTestId("tool-frame").hover();
  await expect(page.getByRole("tooltip")).toContainText("Frame");
  await expect(page.getByRole("tooltip")).toContainText("F");
  await expect(page.getByTestId("tool-image")).toHaveAttribute("aria-keyshortcuts", "Control+Shift+K");
});

test("AC ED-006: tool aktif ditandai aria-pressed; klik & shortcut mengganti tool", async ({ page }) => {
  await expect(page.getByTestId("tool-select")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("tool-frame").click();
  await expect(page.getByTestId("tool-frame")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("tool-select")).toHaveAttribute("aria-pressed", "false");

  await page.getByTestId("editor-canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("t");
  await expect(page.getByTestId("tool-text")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("v");
  await expect(page.getByTestId("tool-select")).toHaveAttribute("aria-pressed", "true");

  // Grup Shape: pilih Ellipse dari menu → tombol grup menjadi Ellipse & aktif.
  await page.getByTestId("tool-shape-menu").click();
  await page.getByRole("menuitem", { name: /Ellipse/ }).click();
  await expect(page.getByTestId("tool-shape")).toHaveAttribute("aria-label", "Ellipse");
  await expect(page.getByTestId("tool-shape")).toHaveAttribute("aria-pressed", "true");
});

test("undo/redo toolbar mengikuti stack; zoom & device switcher; Publish nonaktif", async ({ page }) => {
  await expect(page.getByTestId("toolbar-undo")).toBeDisabled();
  expect(await renamePage(page, await firstPageId(page), "Diubah")).toBe(true);
  await expect(page.getByTestId("editor-page-name")).toHaveText("/ Diubah");
  await expect(page.getByTestId("toolbar-undo")).toBeEnabled();
  await page.getByTestId("toolbar-undo").click();
  await expect(page.getByTestId("editor-page-name")).toHaveText("/ Home");
  await page.getByTestId("toolbar-redo").click();
  await expect(page.getByTestId("editor-page-name")).toHaveText("/ Diubah");

  await page.getByTestId("toolbar-zoom").click();
  await page.getByRole("menuitemradio", { name: "Zoom to 200%" }).click();
  await expect(page.getByTestId("toolbar-zoom")).toHaveText("200%");
  expect(await page.evaluate(() => window.__editorTestApi?.getCamera().zoom)).toBe(2);

  await page.getByTestId("breakpoint-mobile").click();
  await expect(page.getByTestId("breakpoint-mobile")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("breakpoint-base")).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByTestId("toolbar-publish")).toBeDisabled();
});

test("ED-006 edge: layar < 1024px menampilkan pemberitahuan; ≥ 1280px tidak", async ({ page }) => {
  await expect(page.getByTestId("narrow-screen-banner")).toBeHidden();
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(page.getByTestId("narrow-screen-banner")).toContainText("1280px");
});
