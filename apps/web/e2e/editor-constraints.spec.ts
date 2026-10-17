import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.9.1 / ED-098: constraints — set via inspector, resize parent → child mengikuti (Right = jarak kanan tetap).
test.use({ locale: "en-US", storageState: OWNER_STATE });

const sizeFixed = (w: number, h: number) => ({
  width: { mode: "fixed" as const, value: w, unit: "px" as const },
  height: { mode: "fixed" as const, value: h, unit: "px" as const },
});

const posX = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    const doc = window.__editorTestApi?.getDoc() as {
      nodes: Record<string, { style: { base: { position?: { x?: number; constraints?: { horizontal?: string } } } } }>;
    };
    return doc?.nodes[nodeId]?.style.base.position;
  }, id);

test("AC ED-098: constraint Right → resize parent menggeser child menjaga jarak kanan", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Constraints Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  // Frame freeform (layout none) 200×100 di (40,40).
  const frame = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "frame",
        style: {
          base: { layout: { mode: "none" }, position: { type: "absolute", x: 40, y: 40 }, size: sizeFixed(200, 100) },
        },
      })
    ).value,
  );
  // Child absolute (10,20) 40×30.
  const child = String(
    (
      await editorCommand(page, "createNode", {
        parentId: frame,
        type: "frame",
        style: { base: { position: { type: "absolute", x: 10, y: 20 }, size: sizeFixed(40, 30) } },
      })
    ).value,
  );

  // Set constraint horizontal = Right lewat inspector.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), child);
  await page.getByTestId("inspector").getByTestId("inspector-constraint-horizontal").selectOption("right");
  await expect.poll(async () => (await posX(page, child))?.constraints?.horizontal).toBe("right");

  // Pilih frame & seret handle kanan (E) +100 → lebar 200→300.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);
  const handle = page.locator('.overlay-handle[data-handle="e"]');
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  if (!box) throw new Error("handle E tidak terlihat");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();

  // Child Right: jarak kanan 200−10−40=150 tetap → x baru = 300−150−40 = 110.
  await expect.poll(async () => (await posX(page, child))?.x).toBe(110);
});
