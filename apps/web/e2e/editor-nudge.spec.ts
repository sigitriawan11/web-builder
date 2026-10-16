import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.6.2 / ED-064: nudge panah 1px, Shift+panah 10px; child auto-layout = reorder; nudge beruntun = 1 undo.
test.use({ locale: "en-US", storageState: OWNER_STATE });

interface DocNode {
  parentId: string | null;
  children?: string[];
  style: { base: { position?: { x?: number; y?: number } } };
}
const doc = (page: Page) => page.evaluate(() => window.__editorTestApi?.getDoc() as { nodes: Record<string, DocNode> });

async function create(page: Page, args: Record<string, unknown>): Promise<string> {
  const result = await editorCommand(page, "createNode", args);
  expect(result.ok).toBe(true);
  return String(result.value);
}

const sizeFixed = (w: number, h: number) => ({
  width: { mode: "fixed" as const, value: w, unit: "px" as const },
  height: { mode: "fixed" as const, value: h, unit: "px" as const },
});

async function open(page: Page, name: string): Promise<void> {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, name)}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));
}

test("AC ED-064: panah geser 1px, Shift+panah 10px; 10× panah = 1 langkah undo", async ({ page }) => {
  await open(page, "Nudge Test");
  const pageId = await firstPageId(page);
  const frame = await create(page, {
    parentId: pageId,
    type: "frame",
    style: { base: { position: { type: "absolute", x: 100, y: 100 }, size: sizeFixed(80, 80) } },
  });
  const pos = async () => (await doc(page)).nodes[frame]?.style.base.position;

  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);
  await page.keyboard.press("ArrowRight");
  expect(await pos()).toMatchObject({ x: 101, y: 100 });
  await page.keyboard.press("ArrowDown");
  expect(await pos()).toMatchObject({ x: 101, y: 101 });
  await page.keyboard.press("Shift+ArrowRight");
  expect(await pos()).toMatchObject({ x: 111, y: 101 });
  await page.keyboard.press("Shift+ArrowUp");
  expect(await pos()).toMatchObject({ x: 111, y: 91 });

  // Jeda > captureTimeout (500ms) → burst berikutnya jadi langkah undo terpisah dari nudge sebelumnya.
  await page.waitForTimeout(650);
  const base = await pos();
  // 10× panah beruntun (jeda < captureTimeout) → satu langkah undo.
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  expect((await pos())?.x).toBe((base?.x ?? 0) + 10);
  await page.keyboard.press("ControlOrMeta+z");
  expect((await pos())?.x).toBe(base?.x);
});

test("AC ED-064: panah pada child auto-layout = reorder satu indeks", async ({ page }) => {
  await open(page, "Nudge Reorder");
  const pageId = await firstPageId(page);
  const flex = await create(page, {
    parentId: pageId,
    type: "frame",
    style: {
      base: {
        layout: { mode: "flex", direction: "row", gap: { value: 8, unit: "px" } },
        position: { type: "absolute", x: 40, y: 40 },
        size: sizeFixed(320, 100),
      },
    },
  });
  const a = await create(page, { parentId: flex, type: "frame", style: { base: { size: sizeFixed(80, 60) } } });
  const b = await create(page, { parentId: flex, type: "frame", style: { base: { size: sizeFixed(80, 60) } } });

  await page.evaluate((id) => window.__editorTestApi?.select([id]), a);
  await page.keyboard.press("ArrowRight");
  expect((await doc(page)).nodes[flex]?.children).toEqual([b, a]);
  await page.keyboard.press("ArrowLeft");
  expect((await doc(page)).nodes[flex]?.children).toEqual([a, b]);
});
