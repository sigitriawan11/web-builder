import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator } from "./doc-helpers";

// T0.6.5 / ED-063: drag reorder & reparent di auto-layout (fixture autolayout, zoom 100%).

const [ROW, FIX, FILL, HUG] = ["n_alrow00001", "n_alrowfix01", "n_alrowfil01", "n_alrowhug01"];
const COLUMN = "n_alcol00001";
type YNode = { get(key: string): { toJSON(): string[] } };
type Spike = {
  doc: { on(event: "update", listener: () => void): void; getMap(name: string): { get(id: string): YNode } };
  selection: { getState(): { select(ids: string[]): void } };
  undoManager: { undo(): void };
};

async function open(page: Page) {
  await page.goto("?fixture=autolayout&zoom=1&x=0&y=0");
  await page.waitForFunction(() => "__spike" in window);
  await expect(nodeLocator(page, ROW)).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { __spike: Spike; __updates: number };
    w.__updates = 0;
    w.__spike.doc.on("update", () => {
      w.__updates++;
    });
  });
}

const childrenOf = (page: Page, id: string) =>
  page.evaluate(
    (nodeId) =>
      (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes").get(nodeId).get("children").toJSON(),
    id,
  );
const updates = (page: Page) => page.evaluate(() => (window as unknown as { __updates: number }).__updates);
const select = (page: Page, id: string) =>
  page.evaluate(
    (nodeId) => (window as unknown as { __spike: Spike }).__spike.selection.getState().select([nodeId]),
    id,
  );

async function center(page: Page, id: string) {
  const box = await boxOf(nodeLocator(page, id));
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Tekan di tengah node, gerak ke `to`; `beforeRelease` dijalankan sebelum tombol dilepas.
async function dragTo(page: Page, id: string, to: { x: number; y: number }, beforeRelease?: () => Promise<void>) {
  const from = await center(page, id);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await beforeRelease?.();
  await page.mouse.up();
}

test("AC ED-063: penanda & ghost tampil sebelum dilepas; node asli redup; lepas = pindah ke akhir", async ({
  page,
}) => {
  await open(page);
  await select(page, FIX);
  const hug = await boxOf(nodeLocator(page, HUG));

  await dragTo(page, FIX, { x: hug.x + hug.width + 4, y: hug.y + hug.height / 2 }, async () => {
    await expect(page.locator(".overlay-insertion-marker")).toBeVisible();
    await expect(page.locator(".overlay-insertion-marker")).toHaveAttribute("data-orientation", "vertical");
    await expect(page.locator(".overlay-reorder-ghost")).toBeVisible();
    await expect(nodeLocator(page, FIX)).toHaveCSS("opacity", "0.4");
    expect(await updates(page)).toBe(0);
  });

  expect(await childrenOf(page, ROW)).toEqual([FILL, HUG, FIX]);
  expect(await updates(page)).toBe(1);
  await expect(page.locator(".overlay-insertion-marker")).toHaveCount(0);
  await expect(nodeLocator(page, FIX)).toHaveCSS("opacity", "1");

  await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.undoManager.undo());
  expect(await childrenOf(page, ROW)).toEqual([FIX, FILL, HUG]);
});

test("reorder ke tengah: di antara Fill dan Hug", async ({ page }) => {
  await open(page);
  await select(page, FIX);
  const hug = await boxOf(nodeLocator(page, HUG));

  await dragTo(page, FIX, { x: hug.x - 8, y: hug.y + hug.height / 2 });

  expect(await childrenOf(page, ROW)).toEqual([FILL, FIX, HUG]);
});

test("reparent: dari baris ke kolom, dengan penanda horizontal di kolom", async ({ page }) => {
  await open(page);
  await select(page, FIX);
  const column = await boxOf(nodeLocator(page, COLUMN));

  await dragTo(page, FIX, { x: column.x + column.width / 2, y: column.y + column.height - 6 }, async () => {
    await expect(page.locator(".overlay-insertion-marker")).toHaveAttribute("data-orientation", "horizontal");
  });

  expect(await childrenOf(page, ROW)).toEqual([FILL, HUG]);
  expect(await childrenOf(page, COLUMN)).toEqual(["n_alcoltxt01", "n_alcolbox01", "n_alcolbox02", FIX]);
  expect(await updates(page)).toBe(1);
});

test("wrap: pindahkan kotak pertama ke baris kedua setelah kotak ke-4", async ({ page }) => {
  await open(page);
  await select(page, "n_alwrap0a01");
  const fourth = await boxOf(nodeLocator(page, "n_alwrap0a04"));

  await dragTo(page, "n_alwrap0a01", { x: fourth.x + fourth.width - 10, y: fourth.y + fourth.height / 2 });

  expect(await childrenOf(page, "n_alwrap0001")).toEqual([
    "n_alwrap0a02",
    "n_alwrap0a03",
    "n_alwrap0a04",
    "n_alwrap0a01",
    "n_alwrap0a05",
  ]);
});

test("frame non-section di root page: drop di area padding page mengubah urutan", async ({ page }) => {
  await open(page);
  await select(page, COLUMN);
  const row = await boxOf(nodeLocator(page, ROW));

  // Padding page 40px: titik di kiri baris berada di latar page, bukan di dalam baris.
  await dragTo(page, COLUMN, { x: row.x - 20, y: row.y + 6 });

  expect(await childrenOf(page, "pg_home000001")).toEqual([COLUMN, ROW, "n_alwrap0001"]);
});

test("section hanya bisa di-drop ke page: drag Fitur 1 ke atas Hero mengurutkan ulang section (edge ED-063)", async ({
  page,
}) => {
  await page.goto("?fixture=landing200&zoom=0.25&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  const ids = await page.evaluate(() => {
    const nodes = (
      window as unknown as {
        __spike: { doc: { getMap(n: string): { entries(): IterableIterator<[string, { get(k: string): unknown }]> } } };
      }
    ).__spike.doc.getMap("nodes");
    const byName: Record<string, string> = {};
    for (const [id, node] of nodes.entries()) byName[String(node.get("name"))] = id;
    return { hero: byName.Hero ?? "", feature: byName["Fitur 1"] ?? "", page: "pg_bench00001" };
  });
  await select(page, ids.feature);
  const hero = await boxOf(nodeLocator(page, ids.hero));

  // Titik di bagian atas Hero (di dalam section lain): tetap diurutkan di page, tidak masuk ke dalam Hero.
  await dragTo(page, ids.feature, { x: hero.x + hero.width / 2, y: hero.y + 4 });

  const pageChildren = await childrenOf(page, ids.page);
  expect(pageChildren.indexOf(ids.feature)).toBe(pageChildren.indexOf(ids.hero) - 1);
  expect(await childrenOf(page, ids.hero)).not.toContain(ids.feature);
});

test("drop di posisi asal tidak membuat update Yjs (tidak ada langkah undo kosong)", async ({ page }) => {
  await open(page);
  await select(page, FIX);
  const fix = await boxOf(nodeLocator(page, FIX));

  await dragTo(page, FIX, { x: fix.x + 10, y: fix.y + fix.height / 2 + 30 });

  expect(await childrenOf(page, ROW)).toEqual([FIX, FILL, HUG]);
  expect(await updates(page)).toBe(0);
});

test("Esc membatalkan reorder: urutan tetap, node tidak redup, penanda hilang", async ({ page }) => {
  await open(page);
  await select(page, FIX);
  const hug = await boxOf(nodeLocator(page, HUG));

  await dragTo(page, FIX, { x: hug.x + hug.width + 4, y: hug.y + 10 }, async () => {
    await page.keyboard.press("Escape");
  });

  expect(await childrenOf(page, ROW)).toEqual([FIX, FILL, HUG]);
  expect(await updates(page)).toBe(0);
  await expect(nodeLocator(page, FIX)).toHaveCSS("opacity", "1");
  await expect(page.locator(".overlay-insertion-marker")).toHaveCount(0);
});
