import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.1.2 / ED-007: sidebar kiri.
test.use({ locale: "en-US", storageState: OWNER_STATE });

let editorUrl = "";
test.beforeEach(async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  editorUrl = `${APP_URL}/editor/${await createSiteViaApi(page, "Sidebar Test")}`;
  await page.goto(editorUrl);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  // Mulai dari preferensi default untuk test ini.
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage))
      if (key.startsWith("platform.editor.ui:")) localStorage.removeItem(key);
  });
  await page.reload();
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
});

/** Titik world di pusat viewport canvas. */
async function worldAtViewportCenter(page: Page) {
  return page.evaluate(() => {
    const viewport = document.getElementById("editor-viewport");
    const camera = window.__editorTestApi?.getCamera();
    if (!viewport || !camera) return null;
    return {
      x: (viewport.clientWidth / 2 - camera.x) / camera.zoom,
      y: (viewport.clientHeight / 2 - camera.y) / camera.zoom,
    };
  });
}

test("pindah tab; Pages + Layers bersamaan; tab & lebar tersimpan per user setelah reload", async ({ page }) => {
  const sidebar = page.getByTestId("left-sidebar");
  await expect(page.getByTestId("left-tab-layers")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("pages-section")).toBeVisible();
  await expect(page.getByTestId("layers-section")).toBeVisible();
  await expect(sidebar).toHaveCSS("width", "260px");

  await page.getByTestId("left-tab-assets").click();
  await expect(page.getByTestId("left-tab-assets")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("left-placeholder-assets")).toBeVisible();

  // Lebar lewat keyboard (pegangan resize, langkah 16 px).
  await page.getByTestId("left-sidebar-resize").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(sidebar).toHaveCSS("width", "292px");

  await page.reload();
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await expect(page.getByTestId("left-tab-assets")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("left-sidebar")).toHaveCSS("width", "292px");
});

test("shortcut: Alt+1..4 & Mod+\\\\ menciutkan; batas lebar 200–480 saat drag", async ({ page }) => {
  await page.getByTestId("editor-canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Alt+3");
  await expect(page.getByTestId("left-tab-insert")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Alt+1");
  await expect(page.getByTestId("left-tab-layers")).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Control+Backslash");
  await expect(page.getByTestId("left-sidebar")).toHaveCount(0);
  await page.keyboard.press("Alt+4");
  await expect(page.getByTestId("pages-section")).toBeVisible();

  const handle = page.getByTestId("left-sidebar-resize");
  const box = await handle.boundingBox();
  if (!box) throw new Error("pegangan tidak terlihat");
  await page.mouse.move(box.x + box.width / 2, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 900, box.y + 200, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("left-sidebar")).toHaveCSS("width", "480px");
});

test("AC ED-007: resize/ciutkan sidebar tidak membuat canvas lompat (pusat viewport tetap)", async ({ page }) => {
  const before = await worldAtViewportCenter(page);
  await page.getByTestId("left-sidebar-resize").focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("left-sidebar")).toHaveCSS("width", "340px");
  await expect.poll(async () => (await worldAtViewportCenter(page))?.x).toBeCloseTo(before?.x ?? 0, 0);

  await page.getByTestId("editor-canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Control+Backslash");
  await expect(page.getByTestId("left-sidebar")).toHaveCount(0);
  await expect.poll(async () => (await worldAtViewportCenter(page))?.x).toBeCloseTo(before?.x ?? 0, 0);
  expect((await worldAtViewportCenter(page))?.y).toBeCloseTo(before?.y ?? 0, 0);
});
