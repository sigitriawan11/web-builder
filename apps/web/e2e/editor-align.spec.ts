import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.6.8 / ED-072: align (6 arah) & distribute (H/V) untuk node absolute.
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
    style: { base: { position: { type: "absolute", x, y }, size: sizeFixed(20, 20) } },
  });
  expect(result.ok).toBe(true);
  return String(result.value);
}

test("AC ED-072: distribute horizontal menyamakan jarak; align-left meratakan tepi kiri", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Align Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  const a = await frameAt(page, pageId, 0, 0);
  const b = await frameAt(page, pageId, 50, 0);
  const c = await frameAt(page, pageId, 200, 0);
  await page.evaluate((ids) => window.__editorTestApi?.select(ids), [a, b, c]);
  // Pastikan geometri terukur sebelum align (dibaca dari rect world).
  await expect.poll(() => page.evaluate((id) => window.__editorTestApi?.getGeometry(id) ?? null, c)).not.toBeNull();

  // Distribute horizontal: A(0,w20) & C(200,w20) tetap; span 220, sumW 60, gap 80 → B ke x=100.
  await page.getByTestId("distribute-horizontal").click();
  await expect.poll(() => posX(page, b)).toBe(100);
  expect(await posX(page, a)).toBe(0);
  expect(await posX(page, c)).toBe(200);

  // Align left: semua tepi kiri rata ke bounds.x (0).
  await page.getByTestId("align-left").click();
  await expect.poll(() => posX(page, b)).toBe(0);
  expect(await posX(page, c)).toBe(0);
});

test("ED-072: shortcut Alt+KeyD meratakan ke kanan bounding seleksi", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Align Shortcut")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  const a = await frameAt(page, pageId, 0, 0);
  const c = await frameAt(page, pageId, 200, 0);
  await page.evaluate((ids) => window.__editorTestApi?.select(ids), [a, c]);
  await expect.poll(() => page.evaluate((id) => window.__editorTestApi?.getGeometry(id) ?? null, c)).not.toBeNull();

  // Bounds kanan = 220; A (kanan 20) → x=200; C tetap 200.
  await page.keyboard.press("Alt+KeyD");
  await expect.poll(() => posX(page, a)).toBe(200);
  expect(await posX(page, c)).toBe(200);
});
