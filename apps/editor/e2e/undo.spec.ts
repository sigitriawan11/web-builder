import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator, selectedIds } from "./doc-helpers";

// T0.7.1 / ED-197: undo/redo lewat keyboard, satu aksi = satu langkah, seleksi dipulihkan.

const [CARD, IMAGE] = ["n_fcard00001", "n_fimage0001"];
type Spike = {
  doc: { toJSON(): unknown };
  selection: { getState(): { select(ids: string[]): void } };
  undoManager: { undoStack: unknown[] };
};

const docJson = (page: Page) => page.evaluate(() => JSON.stringify((window as unknown as { __spike: Spike }).__spike.doc.toJSON()));
const undoSteps = (page: Page) => page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.undoManager.undoStack.length);
const select = (page: Page, ids: string[]) =>
  page.evaluate((selection) => (window as unknown as { __spike: Spike }).__spike.selection.getState().select(selection), ids);

async function dragNode(page: Page, id: string, dx: number, dy: number) {
  const box = await boxOf(nodeLocator(page, id));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 5 });
  await page.mouse.up();
}

async function dragHandle(page: Page, handle: string, dx: number) {
  const box = await boxOf(page.locator(`.overlay-handle[data-handle="${handle}"]`));
  await page.mouse.move(box.x + 5, box.y + 5);
  await page.mouse.down();
  await page.mouse.move(box.x + 5 + dx, box.y + 5, { steps: 5 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=freeform&zoom=1&x=20&y=20");
  await expect(nodeLocator(page, CARD)).toBeVisible();
});

test("drag lalu resize → Ctrl+Z dua kali memulihkan dokumen & seleksi; Ctrl+Shift+Z / Ctrl+Y redo", async ({ page }) => {
  const initial = await docJson(page);
  await select(page, [CARD]);
  await dragNode(page, CARD, 40, 30);
  const afterDrag = await docJson(page);
  await select(page, [IMAGE]);
  await expect(page.locator('.overlay-handle[data-handle="e"]')).toBeVisible();
  await dragHandle(page, "e", 60);
  const afterResize = await docJson(page);
  expect(await undoSteps(page)).toBe(2);
  await select(page, []);

  await page.keyboard.press("Control+KeyZ");
  expect(await docJson(page)).toBe(afterDrag);
  expect(await selectedIds(page)).toEqual([IMAGE]);
  await page.keyboard.press("Control+KeyZ");
  expect(await docJson(page)).toBe(initial);
  expect(await selectedIds(page)).toEqual([CARD]);

  await page.keyboard.press("Control+Shift+KeyZ");
  expect(await docJson(page)).toBe(afterDrag);
  await page.keyboard.press("Control+KeyY");
  expect(await docJson(page)).toBe(afterResize);
  expect(await selectedIds(page)).toEqual([IMAGE]);
});

test("dua drag cepat berturut-turut tetap dua langkah undo (tidak digabung captureTimeout)", async ({ page }) => {
  await select(page, [CARD]);
  await dragNode(page, CARD, 20, 0);
  await dragNode(page, CARD, 20, 0);

  expect(await undoSteps(page)).toBe(2);
});

test("Ctrl+Z saat mengedit teks tidak membatalkan perubahan dokumen", async ({ page }) => {
  await select(page, [CARD]);
  await dragNode(page, CARD, 30, 0);
  const afterDrag = await docJson(page);

  await select(page, ["n_ftext00001"]);
  await nodeLocator(page, "n_ftext00001").dblclick();
  await expect(nodeLocator(page, "n_ftext00001").locator(".ProseMirror")).toBeFocused();
  await page.keyboard.press("Control+KeyZ");

  expect(await docJson(page)).toBe(afterDrag);
});
