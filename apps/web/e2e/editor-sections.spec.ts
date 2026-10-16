import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.3.4 / ED-036: urutan section & proteksi page root.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const children = (page: Page, parentId: string) =>
  page.evaluate((id) => {
    const doc = window.__editorTestApi?.getDoc() as { nodes: Record<string, { children?: string[] }> };
    return doc.nodes[id]?.children ?? [];
  }, parentId);

test("AC ED-036: reorder section via keyboard (Mod+] / Mod+[); berhenti di ujung", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Sections Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  const pageId = await firstPageId(page);
  const a = String((await editorCommand(page, "createNode", { parentId: pageId, type: "frame", name: "A" })).value);
  const b = String((await editorCommand(page, "createNode", { parentId: pageId, type: "frame", name: "B" })).value);
  const c = String((await editorCommand(page, "createNode", { parentId: pageId, type: "frame", name: "C" })).value);
  expect(await children(page, pageId)).toEqual([a, b, c]);

  const canvas = page.getByTestId("editor-canvas");
  await canvas.click({ position: { x: 5, y: 5 } });
  await page.evaluate((id) => window.__editorTestApi?.select([id]), a);
  // Turun satu: [b, a, c].
  await page.keyboard.press("Control+BracketRight");
  await expect.poll(() => children(page, pageId)).toEqual([b, a, c]);
  // Naik satu: kembali [a, b, c].
  await page.keyboard.press("Control+BracketLeft");
  await expect.poll(() => children(page, pageId)).toEqual([a, b, c]);
  // Di ujung atas: tidak berubah.
  await page.keyboard.press("Control+BracketLeft");
  await page.waitForTimeout(150);
  expect(await children(page, pageId)).toEqual([a, b, c]);

  // Undo mengembalikan reorder (satu langkah).
  await page.evaluate((id) => window.__editorTestApi?.select([id]), c);
  await page.keyboard.press("Control+BracketLeft");
  await expect.poll(() => children(page, pageId)).toEqual([a, c, b]);
  await page.keyboard.press("Control+z");
  await expect.poll(() => children(page, pageId)).toEqual([a, b, c]);
});

test("AC ED-036: page root tanpa handle resize; Delete tidak menghapus (toast)", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Page Root Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  const pageId = await firstPageId(page);
  await page.getByTestId("editor-canvas").click({ position: { x: 5, y: 5 } });
  await page.evaluate((id) => window.__editorTestApi?.select([id]), pageId);
  // Tanpa handle resize untuk page.
  await expect(page.locator(".overlay-handle")).toHaveCount(0);
  // Delete → page tetap ada + toast.
  await page.keyboard.press("Delete");
  await expect(page.getByTestId("toasts")).toContainText("The page can't be deleted from here.");
  const pageCount = await page.evaluate(() => {
    const doc = window.__editorTestApi?.getDoc() as { pageOrder: string[] } | undefined;
    return doc?.pageOrder.length ?? 0;
  });
  expect(pageCount).toBe(1);

  // Frame biasa punya handle resize.
  const frame = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "frame",
        name: "Box",
        style: {
          base: {
            size: {
              width: { mode: "fixed", value: 200, unit: "px" },
              height: { mode: "fixed", value: 100, unit: "px" },
            },
          },
        },
      })
    ).value,
  );
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);
  await expect(page.locator(".overlay-handle")).toHaveCount(8);
});
