import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.10.1/T2.10.2 / ED-102: fill solid — tambah/warna (color picker)/toggle/hapus.
test.use({ locale: "en-US", storageState: OWNER_STATE });

interface DocNode {
  style: { base: { fills?: { type: string; color?: string; visible?: boolean }[] } };
}
const fillsOf = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    const doc = window.__editorTestApi?.getDoc() as { nodes: Record<string, DocNode> };
    return doc?.nodes[nodeId]?.style.base.fills ?? [];
  }, id);

test("AC ED-102: tambah fill, atur warna via picker (hex), toggle & hapus", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Fill Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  const frame = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "frame",
        style: {
          base: {
            position: { type: "absolute", x: 20, y: 20 },
            size: {
              width: { mode: "fixed", value: 120, unit: "px" },
              height: { mode: "fixed", value: 80, unit: "px" },
            },
          },
        },
      })
    ).value,
  );
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);

  const inspector = page.getByTestId("inspector");
  // Tambah fill → solid hitam.
  await inspector.getByTestId("fill-add").click();
  await expect.poll(() => fillsOf(page, frame)).toEqual([{ type: "solid", color: "#000000" }]);

  // Buka picker & set hex merah.
  await inspector.getByTestId("fill-color-0").click();
  const hex = page.getByTestId("fill-color-0-hex");
  await expect(hex).toBeVisible();
  await hex.fill("ff0000");
  await expect.poll(async () => (await fillsOf(page, frame))[0]?.color).toBe("#ff0000");
  // Node merah di canvas.
  await expect(page.getByTestId("editor-canvas").locator(`[data-node-id="${frame}"]`)).toHaveCSS(
    "background-color",
    "rgb(255, 0, 0)",
  );
  await page.keyboard.press("Escape"); // tutup popover

  // Toggle visibility → visible false.
  await inspector.getByTestId("fill-visible-0").click();
  await expect.poll(async () => (await fillsOf(page, frame))[0]?.visible).toBe(false);

  // Hapus fill → kosong.
  await inspector.getByTestId("fill-remove-0").click();
  await expect.poll(() => fillsOf(page, frame)).toEqual([]);
});
