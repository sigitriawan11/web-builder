import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator, selectedIds } from "./doc-helpers";

// T0.7.1 / ED-197: undo/redo lewat keyboard, satu aksi = satu langkah, seleksi dipulihkan.

const [CARD, IMAGE] = ["n_fcard00001", "n_fimage0001"];
type Spike = {
  doc: { toJSON(): unknown };
  selection: { getState(): { select(ids: string[]): void } };
  undoManager: { undoStack: unknown[] };
};

const docJson = (page: Page) =>
  page.evaluate(() => JSON.stringify((window as unknown as { __spike: Spike }).__spike.doc.toJSON()));
const undoSteps = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.undoManager.undoStack.length);
const select = (page: Page, ids: string[]) =>
  page.evaluate(
    (selection) => (window as unknown as { __spike: Spike }).__spike.selection.getState().select(selection),
    ids,
  );

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

test("drag lalu resize → Ctrl+Z dua kali memulihkan dokumen & seleksi; Ctrl+Shift+Z / Ctrl+Y redo", async ({
  page,
}) => {
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

const TEXT = "n_ftext00001";
const ORIGINAL_TEXT = "Seret aku ke mana saja";
const cardX = (page: Page) =>
  page.evaluate(() => {
    const spike = (
      window as unknown as {
        __spike: {
          doc: {
            getMap(name: string): { get(id: string): { toJSON(): { style: { base: { position: { x: number } } } } } };
          };
        };
      }
    ).__spike;
    return spike.doc.getMap("nodes").get("n_fcard00001").toJSON().style.base.position.x;
  });

async function editText(page: Page, typed: string) {
  await select(page, [TEXT]);
  await nodeLocator(page, TEXT).dblclick();
  await expect(nodeLocator(page, TEXT).locator(".ProseMirror")).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.type(typed);
}

// T0.8.5: ketikan Tiptap masuk Y.XmlFragment dengan origin ySync dan berbagi stack undo dengan aksi canvas.
test("Ctrl+Z saat mengedit teks membatalkan ketikan, bukan aksi canvas sebelumnya", async ({ page }) => {
  // Regresi T0.8.5: binding y-tiptap memanggil `root.createRange()`, yang tidak ada di ShadowRoot (ADR-012).
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await select(page, [CARD]);
  await dragNode(page, CARD, 30, 0);
  const xAfterDrag = await cardX(page);

  await editText(page, "abc");
  await expect(nodeLocator(page, TEXT).locator(".ProseMirror")).toHaveText(`${ORIGINAL_TEXT}abc`);
  await page.keyboard.press("Control+KeyZ");

  await expect(nodeLocator(page, TEXT).locator(".ProseMirror")).toHaveText(ORIGINAL_TEXT);
  expect(await cardX(page)).toBe(xAfterDrag);
  expect(errors).toEqual([]);
});

test("Ctrl+Z di dalam sesi edit granular per jeda ketik; setelah keluar, satu sesi = satu langkah undo", async ({
  page,
}) => {
  await editText(page, "abc");
  // Jeda > captureTimeout (500 ms) memisahkan langkah selama sesi masih terbuka.
  await page.waitForTimeout(700);
  await page.keyboard.type("def");
  await page.keyboard.press("Control+KeyZ");
  await expect(nodeLocator(page, TEXT).locator(".ProseMirror")).toHaveText(`${ORIGINAL_TEXT}abc`);
  await page.keyboard.press("Control+Shift+KeyZ");
  await expect(nodeLocator(page, TEXT).locator(".ProseMirror")).toHaveText(`${ORIGINAL_TEXT}abcdef`);

  await page.keyboard.press("Escape");
  await expect(nodeLocator(page, TEXT)).toHaveText(`${ORIGINAL_TEXT}abcdef`);
  await select(page, [CARD]);
  await page.keyboard.press("Control+KeyZ");

  await expect(nodeLocator(page, TEXT)).toHaveText(ORIGINAL_TEXT);
  expect(await selectedIds(page)).toEqual([TEXT]);
  await page.keyboard.press("Control+Shift+KeyZ");
  await expect(nodeLocator(page, TEXT)).toHaveText(`${ORIGINAL_TEXT}abcdef`);
});
