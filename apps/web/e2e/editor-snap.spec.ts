import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.7.1 / ED-073: smart guides & snapping ke tepi sibling (threshold 5px screen).
test.use({ locale: "en-US", storageState: OWNER_STATE });

interface DocNode {
  style: { base: { position?: { x?: number; y?: number } } };
}
const posX = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    const doc = window.__editorTestApi?.getDoc() as { nodes: Record<string, DocNode> };
    return doc?.nodes[nodeId]?.style.base.position?.x;
  }, id);

const sizeFixed = (w: number, h: number) => ({
  width: { mode: "fixed" as const, value: w, unit: "px" as const },
  height: { mode: "fixed" as const, value: h, unit: "px" as const },
});

async function frameAt(page: Page, parentId: string, x: number, y: number): Promise<string> {
  const result = await editorCommand(page, "createNode", {
    parentId,
    type: "frame",
    style: { base: { position: { type: "absolute", x, y }, size: sizeFixed(60, 60) } },
  });
  expect(result.ok).toBe(true);
  return String(result.value);
}

test("AC ED-073: drag mendekati tepi kiri sibling (≤5px) → snap sejajar + guide tampil", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Snap Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  const a = await frameAt(page, pageId, 100, 50);
  const b = await frameAt(page, pageId, 300, 200);
  await page.evaluate((id) => window.__editorTestApi?.select([id]), b);

  const box = await page.getByTestId("editor-canvas").boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");
  const geo = await page.evaluate((id) => window.__editorTestApi?.getGeometry(id) ?? null, b);
  if (!geo) throw new Error("geometri B tidak ada");

  // Seret B agar tepi kirinya 3px di kanan tepi kiri A (300 → 103): snap ke 100.
  const start = { x: box.x + geo.x + geo.width / 2, y: box.y + geo.y + geo.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x - 197, start.y, { steps: 10 });
  await expect(page.locator('.overlay-snap-guide[data-axis="x"]').first()).toBeVisible();
  await page.mouse.up();

  // Tepi kiri B snap ke tepi kiri A (x=100).
  await expect.poll(() => posX(page, b)).toBe(100);
  expect(await posX(page, a)).toBe(100);
});
