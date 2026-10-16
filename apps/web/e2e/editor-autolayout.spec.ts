import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.8.1 / ED-079: add/remove auto-layout (Shift+A / Shift+Alt+A) dengan inferensi direction/gap.
test.use({ locale: "en-US", storageState: OWNER_STATE });

interface DocNode {
  parentId: string | null;
  children?: string[];
  style: {
    base: {
      layout?: { mode?: string; direction?: string; gap?: { value?: number } };
      position?: { type?: string; y?: number };
    };
  };
}
const doc = (page: Page) => page.evaluate(() => window.__editorTestApi?.getDoc() as { nodes: Record<string, DocNode> });
const selection = (page: Page) => page.evaluate(() => window.__editorTestApi?.getSelection() ?? []);

const sizeFixed = (w: number, h: number) => ({
  width: { mode: "fixed" as const, value: w, unit: "px" as const },
  height: { mode: "fixed" as const, value: h, unit: "px" as const },
});

async function frameAt(page: Page, parentId: string, x: number, y: number, w = 100, h = 20): Promise<string> {
  const result = await editorCommand(page, "createNode", {
    parentId,
    type: "frame",
    style: { base: { position: { type: "absolute", x, y }, size: sizeFixed(w, h) } },
  });
  expect(result.ok).toBe(true);
  return String(result.value);
}

test("AC ED-079: Shift+A membungkus 3 node vertikal → frame column gap median; Shift+Alt+A mengembalikan", async ({
  page,
}) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Auto Layout Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  // Tiga node bertumpuk vertikal: y 0/40/80, tinggi 20 → gap seragam 20.
  const a = await frameAt(page, pageId, 10, 0);
  const b = await frameAt(page, pageId, 10, 40);
  const c = await frameAt(page, pageId, 10, 80);
  await page.evaluate((ids) => window.__editorTestApi?.select(ids), [a, b, c]);
  await expect.poll(() => page.evaluate((id) => window.__editorTestApi?.getGeometry(id) ?? null, c)).not.toBeNull();

  await page.keyboard.press("Shift+KeyA");

  // Frame baru terpilih, berisi ketiga node (urut), flex column, gap 20.
  await expect.poll(async () => (await selection(page)).length).toBe(1);
  const frameId = (await selection(page))[0] as string;
  const frame = (await doc(page)).nodes[frameId];
  expect(frame?.children).toEqual([a, b, c]);
  expect(frame?.style.base.layout).toMatchObject({ mode: "flex", direction: "column", gap: { value: 20 } });
  // Anak menjadi flow (bukan absolute).
  expect((await doc(page)).nodes[a]?.style.base.position?.type).not.toBe("absolute");
  expect((await doc(page)).nodes[a]?.parentId).toBe(frameId);

  // Shift+Alt+A → frame kembali freeform, anak jadi absolute lagi (posisi visual dipertahankan).
  await page.keyboard.press("Shift+Alt+KeyA");
  await expect.poll(async () => (await doc(page)).nodes[frameId]?.style.base.layout?.mode).toBe("none");
  const firstChild = (await doc(page)).nodes[a];
  expect(firstChild?.style.base.position?.type).toBe("absolute");
  expect(firstChild?.style.base.position?.y).toBe(0);
});

test("ED-079: Shift+A pada frame freeform (anak horizontal) → flex row", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Auto Layout Frame")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  const frame = await frameAt(page, pageId, 0, 0, 400, 120);
  await frameAt(page, frame, 20, 20, 80, 60);
  await frameAt(page, frame, 140, 20, 80, 60);
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);
  await expect.poll(() => page.evaluate((id) => window.__editorTestApi?.getGeometry(id) ?? null, frame)).not.toBeNull();

  await page.keyboard.press("Shift+KeyA");
  await expect.poll(async () => (await doc(page)).nodes[frame]?.style.base.layout?.mode).toBe("flex");
  expect((await doc(page)).nodes[frame]?.style.base.layout?.direction).toBe("row");
});
