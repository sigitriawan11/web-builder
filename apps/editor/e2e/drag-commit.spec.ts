import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator } from "./doc-helpers";

// T0.6.1 / ED-024: preview sementara selama drag, commit satu transaksi saat dilepas.

const IMAGE = "n_heroimg001";
type Spike = {
  doc: { on(event: "update", listener: () => void): void };
  selection: { getState(): { select(ids: string[]): void } };
  undoManager: { undo(): void; undoStack: unknown[] };
};

async function setup(page: Page) {
  await page.goto("?fixture=hero&zoom=0.5&x=20&y=20");
  await page.evaluate(() => {
    const s = (window as unknown as { __spike: Spike }).__spike;
    (window as unknown as { __updates: number }).__updates = 0;
    s.doc.on("update", () => {
      (window as unknown as { __updates: number }).__updates++;
    });
    s.selection.getState().select(["n_heroimg001"]);
  });
  await expect(page.locator('.overlay-handle[data-handle="se"]')).toBeVisible();
}

const updates = (page: Page) => page.evaluate(() => (window as unknown as { __updates: number }).__updates);
const undoSteps = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.undoManager.undoStack.length);
const docSnapshot = (page: Page) =>
  page.evaluate(() =>
    JSON.stringify((window as unknown as { __spike: { doc: { toJSON(): unknown } } }).__spike.doc.toJSON()),
  );

async function startResize(page: Page) {
  const handle = await boxOf(page.locator('.overlay-handle[data-handle="se"]'));
  await page.mouse.move(handle.x + 5, handle.y + 5);
  await page.mouse.down();
  return handle;
}

test("selama drag: preview terlihat tanpa update Yjs; dilepas: tepat 1 update & 1 langkah undo", async ({ page }) => {
  await setup(page);
  const before = await boxOf(nodeLocator(page, IMAGE));
  const original = await docSnapshot(page);

  const handle = await startResize(page);
  await page.mouse.move(handle.x + 5 - 100, handle.y + 5 + 50, { steps: 8 });
  // Zoom 50%: geser -100/+50 px screen = -200/+100 px world.
  await expect
    .poll(async () => Math.round((await boxOf(nodeLocator(page, IMAGE))).height))
    .toBe(Math.round(before.height + 50));
  expect(await updates(page)).toBe(0);

  await page.mouse.up();
  expect(await updates(page)).toBe(1);
  expect(await undoSteps(page)).toBe(1);
  await expect(nodeLocator(page, IMAGE)).toHaveCSS("height", `${Math.round(before.height / 0.5 + 100)}px`);

  await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.undoManager.undo());
  expect(await docSnapshot(page)).toBe(original);
  await expect
    .poll(async () => Math.round((await boxOf(nodeLocator(page, IMAGE))).height))
    .toBe(Math.round(before.height));
});

test("drag 2 detik menghasilkan tepat 1 update Yjs dan 1 langkah undo (AC ED-024)", async ({ page }) => {
  await setup(page);
  const handle = await startResize(page);
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(handle.x + 5 + i * 3, handle.y + 5 + i * 2);
    await page.waitForTimeout(100);
  }
  expect(await updates(page)).toBe(0);
  await page.mouse.up();

  expect(await updates(page)).toBe(1);
  expect(await undoSteps(page)).toBe(1);
});

test("Esc saat drag: dokumen identik & preview hilang (AC ED-024)", async ({ page }) => {
  await setup(page);
  const before = await boxOf(nodeLocator(page, IMAGE));
  const original = await docSnapshot(page);

  const handle = await startResize(page);
  await page.mouse.move(handle.x + 5 + 80, handle.y + 5 + 80, { steps: 6 });
  await expect
    .poll(async () => Math.round((await boxOf(nodeLocator(page, IMAGE))).height))
    .not.toBe(Math.round(before.height));
  await page.keyboard.press("Escape");
  await page.mouse.up();

  expect(await updates(page)).toBe(0);
  expect(await docSnapshot(page)).toBe(original);
  await expect
    .poll(async () => Math.round((await boxOf(nodeLocator(page, IMAGE))).height))
    .toBe(Math.round(before.height));
});
