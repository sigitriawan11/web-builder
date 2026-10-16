import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.1.4 / ED-009: bottom bar & zoom control.
test.use({ locale: "en-US", storageState: OWNER_STATE });

test.beforeEach(async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Bottom Bar Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
});

const camera = (page: Page) => page.evaluate(() => window.__editorTestApi?.getCamera());
async function worldAtCenter(page: Page) {
  return page.evaluate(() => {
    const viewport = document.getElementById("editor-viewport");
    const cam = window.__editorTestApi?.getCamera();
    if (!viewport || !cam) return null;
    return { x: (viewport.clientWidth / 2 - cam.x) / cam.zoom, y: (viewport.clientHeight / 2 - cam.y) / cam.zoom };
  });
}

test("AC ED-009: ketik 150 + Enter → zoom 150% berpusat di tengah viewport; input tidak valid diabaikan", async ({
  page,
}) => {
  const before = await worldAtCenter(page);
  const input = page.getByTestId("zoom-input");
  await input.click();
  await input.fill("150");
  await input.press("Enter");
  await expect(input).toHaveValue("150%");
  expect((await camera(page))?.zoom).toBe(1.5);
  const after = await worldAtCenter(page);
  expect(after?.x).toBeCloseTo(before?.x ?? 0, 3);
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 3);

  await input.click();
  await input.fill("abc");
  await input.press("Enter");
  await expect(input).toHaveValue("150%");
  await page.getByTestId("zoom-in").click();
  expect((await camera(page))?.zoom).toBe(2);
  await page.getByTestId("zoom-out").click();
  expect((await camera(page))?.zoom).toBe(1.5);
});

test("menu zoom: fit & ke seleksi (≤ 400%); info seleksi tipe/nama/W×H; jumlah node; koneksi; bisa disembunyikan", async ({
  page,
  context,
}) => {
  const bar = page.getByTestId("bottom-bar");
  await expect(bar.getByTestId("node-count")).toHaveText("1 / 2000 nodes");
  await expect(bar.getByTestId("connection-indicator")).toHaveText("Online");

  const pageId = await firstPageId(page);
  const frame = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "frame",
        name: "Kotak",
        style: {
          base: {
            size: { width: { mode: "fixed", value: 4, unit: "px" }, height: { mode: "fixed", value: 4, unit: "px" } },
          },
        },
      })
    ).value,
  );
  await expect(bar.getByTestId("node-count")).toHaveText("2 / 2000 nodes");
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);
  await expect(bar.getByTestId("selection-info")).toContainText("Frame");
  await expect(bar.getByTestId("selection-info")).toContainText("Kotak");
  await expect(bar.getByTestId("selection-size")).toHaveText("4 × 4");

  await bar.getByTestId("zoom-menu").click();
  await page.getByRole("menuitem", { name: /Zoom to selection/ }).click();
  expect((await camera(page))?.zoom).toBe(4);
  await bar.getByTestId("zoom-menu").click();
  await page.getByRole("menuitem", { name: /Zoom to fit/ }).click();
  expect((await camera(page))?.zoom).toBeLessThan(1);

  await context.setOffline(true);
  await expect(bar.getByTestId("connection-indicator")).toHaveText("Offline");
  await context.setOffline(false);
  await expect(bar.getByTestId("connection-indicator")).toHaveText("Online", { timeout: 15_000 });

  // View → sembunyikan bar bawah.
  await page.getByTestId("toolbar-menu").click();
  await page.getByRole("menuitem", { name: "View" }).click();
  await page.getByTestId("toggle-bottom-bar").click();
  await expect(page.getByTestId("bottom-bar")).toHaveCount(0);
});
