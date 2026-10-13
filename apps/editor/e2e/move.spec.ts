import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator, selectedIds } from "./doc-helpers";

// T0.6.2 / ED-062: drag move node absolute di papan freeform.

const CARD = "n_fcard00001";
const IMAGE = "n_fimage0001";
type YMapLike = { get(key: string): unknown; toJSON(): unknown };
type Spike = {
  doc: { on(event: "update", listener: () => void): void; getMap(name: string): { get(id: string): YMapLike }; toJSON(): unknown };
  selection: { getState(): { select(ids: string[]): void } };
  undoManager: { undo(): void; undoStack: unknown[] };
};

async function open(page: Page, zoom: number) {
  await page.goto(`?fixture=freeform&zoom=${zoom}&x=20&y=20`);
  await expect(nodeLocator(page, CARD)).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __spike: Spike; __updates: number };
    w.__updates = 0;
    w.__spike.doc.on("update", () => {
      w.__updates++;
    });
  });
}

const updates = (page: Page) => page.evaluate(() => (window as unknown as { __updates: number }).__updates);
const positionOf = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    const node = (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes").get(nodeId);
    const style = (node.get("style") as YMapLike).get("base") as YMapLike;
    return (style.get("position") as { x: number; y: number } | undefined) ?? null;
  }, id);
const docJson = (page: Page) => page.evaluate(() => JSON.stringify((window as unknown as { __spike: Spike }).__spike.doc.toJSON()));
const select = (page: Page, ids: string[]) =>
  page.evaluate((selection) => (window as unknown as { __spike: Spike }).__spike.selection.getState().select(selection), ids);

async function dragBy(page: Page, id: string, dx: number, dy: number, options: { shift?: boolean; escape?: boolean } = {}) {
  const box = await boxOf(nodeLocator(page, id));
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  if (options.shift) await page.keyboard.down("Shift");
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  if (options.escape) await page.keyboard.press("Escape");
  await page.mouse.up();
  if (options.shift) await page.keyboard.up("Shift");
}

for (const zoom of [0.5, 1, 2]) {
  test(`zoom ${zoom * 100}%: node mengikuti pointer, 1 update Yjs & 1 langkah undo`, async ({ page }) => {
    await open(page, zoom);
    // Masuk ke kartu (klik pertama memilih Papan, ED-051).
    await nodeLocator(page, CARD).dblclick();
    expect(await selectedIds(page)).toEqual([CARD]);
    const before = await boxOf(nodeLocator(page, CARD));
    const original = await docJson(page);
    const baseUpdates = await updates(page);

    await dragBy(page, CARD, 60, 30);

    expect(await positionOf(page, CARD)).toMatchObject({ x: 80 + Math.round(60 / zoom), y: 80 + Math.round(30 / zoom) });
    expect((await updates(page)) - baseUpdates).toBe(1);
    const after = await boxOf(nodeLocator(page, CARD));
    expect(Math.abs(after.x - before.x - 60)).toBeLessThanOrEqual(1);

    await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.undoManager.undo());
    expect(await docJson(page)).toBe(original);
  });
}

test("Shift mengunci ke sumbu dominan: hanya x yang berubah (AC ED-062)", async ({ page }) => {
  await open(page, 1);
  await select(page, [CARD]);

  await dragBy(page, CARD, 90, 25, { shift: true });

  expect(await positionOf(page, CARD)).toMatchObject({ x: 170, y: 80 });
});

test("multi-seleksi bergerak bersama dalam satu update", async ({ page }) => {
  await open(page, 1);
  await select(page, [CARD, IMAGE]);

  await dragBy(page, IMAGE, -40, 50);

  expect(await positionOf(page, CARD)).toMatchObject({ x: 40, y: 130 });
  expect(await positionOf(page, IMAGE)).toMatchObject({ x: 380, y: 170 });
  expect(await updates(page)).toBe(1);
});

test("kotak seleksi ikut bergeser selama drag; Esc mengembalikan semuanya tanpa update", async ({ page }) => {
  await open(page, 1);
  await select(page, [CARD]);
  const card = await boxOf(nodeLocator(page, CARD));
  const original = await docJson(page);

  await page.mouse.move(card.x + 20, card.y + 20);
  await page.mouse.down();
  await page.mouse.move(card.x + 120, card.y + 20, { steps: 8 });
  await expect.poll(async () => Math.round((await boxOf(page.locator(".overlay-selection-outline"))).x)).toBe(Math.round(card.x + 100));
  await expect.poll(async () => Math.round((await boxOf(nodeLocator(page, CARD))).x)).toBe(Math.round(card.x + 100));
  await page.keyboard.press("Escape");
  await page.mouse.up();

  expect(await updates(page)).toBe(0);
  expect(await docJson(page)).toBe(original);
  await expect.poll(async () => Math.round((await boxOf(nodeLocator(page, CARD))).x)).toBe(Math.round(card.x));
});

// Anak auto-layout memakai reorder (T0.6.5), bukan posisi absolute; Hero satu-satunya section → drop di tempat asal.
test("node bukan absolute (anak auto-layout) tidak mendapat posisi absolute dari drag", async ({ page }) => {
  await page.goto("?fixture=hero&zoom=0.5&x=20&y=20");
  await page.evaluate(() => {
    const w = window as unknown as { __spike: Spike; __updates: number };
    w.__updates = 0;
    w.__spike.doc.on("update", () => {
      w.__updates++;
    });
  });
  await dragBy(page, "n_heroimg001", 80, 40);

  expect(await updates(page)).toBe(0);
});
