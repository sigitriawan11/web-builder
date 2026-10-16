import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.7.3 / ED-076: pengukuran jarak Alt+hover antara node terseleksi & node yang di-hover.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const sizeFixed = (w: number, h: number) => ({
  width: { mode: "fixed" as const, value: w, unit: "px" as const },
  height: { mode: "fixed" as const, value: h, unit: "px" as const },
});

async function frameAt(page: Page, parentId: string, x: number, y: number): Promise<string> {
  const result = await editorCommand(page, "createNode", {
    parentId,
    type: "frame",
    style: { base: { position: { type: "absolute", x, y }, size: sizeFixed(80, 80) } },
  });
  expect(result.ok).toBe(true);
  return String(result.value);
}

test("AC ED-076: node terpilih + Alt+hover sibling → label jarak = selisih geometry", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Measure Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  const a = await frameAt(page, pageId, 100, 100);
  const b = await frameAt(page, pageId, 300, 100);
  await page.evaluate((id) => window.__editorTestApi?.select([id]), a);

  const box = await page.getByTestId("editor-canvas").boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");
  const geoB = await page.evaluate((id) => window.__editorTestApi?.getGeometry(id) ?? null, b);
  if (!geoB) throw new Error("geometri B tidak ada");

  // Tahan Alt & hover tengah B: celah A(kanan 180) → B(kiri 300) = 120.
  await page.keyboard.down("Alt");
  await page.mouse.move(box.x + geoB.x + geoB.width / 2, box.y + geoB.y + geoB.height / 2);
  await expect(page.getByTestId("measure-label").filter({ hasText: "120" })).toBeVisible();
  await page.keyboard.up("Alt");

  // Alt dilepas → label hilang.
  await expect(page.getByTestId("measure-label")).toHaveCount(0);
});
