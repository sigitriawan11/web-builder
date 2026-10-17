import { expect, type Page, test } from "@playwright/test";
import { idByName } from "./doc-helpers";

// T2.16.2 / ED-203: implementasi baris P0 tabel shortcut, diverifikasi data-driven. Fokus pada perilaku yang teramati
// di playground canvas (arrange z-order = baru; lock/hide/undo = terdaftar di registry). Tool/zoom/breakpoint/nudge
// punya spec tersendiri (editor-toolbar/zoom/move/frames).

type Spike = {
  doc: { getMap(name: string): { get(id: string): { get(key: string): unknown } | undefined } };
  selection: { getState(): { select(ids: readonly string[]): void } };
  undo: { undo(): void };
};
function childrenOf(page: Page, id: string): Promise<string[]> {
  return page.evaluate((nid) => {
    const node = (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes").get(nid);
    const kids = node?.get("children") as { toArray?(): string[] } | undefined;
    return kids?.toArray?.() ?? [];
  }, id);
}
const fieldOf = (page: Page, id: string, key: string) =>
  page.evaluate(([nid, k]) => (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes").get(nid)?.get(k), [
    id,
    key,
  ] as [string, string]);
const select = (page: Page, id: string) =>
  page.evaluate((nid) => (window as unknown as { __spike: Spike }).__spike.selection.getState().select([nid]), id);

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=landing200&zoom=0.5&x=20&y=20");
  await expect(page.locator("[data-node-id]").first()).toBeVisible();
});

test("AC ED-203: arrange z-order — forward/front/back + undo", async ({ page }) => {
  const heroId = await idByName(page, "Hero");
  const pageId = (await fieldOf(page, heroId, "parentId")) as string;
  const before = await childrenOf(page, pageId);
  const heroIndex = before.indexOf(heroId);
  expect(heroIndex).toBeGreaterThanOrEqual(0);
  expect(before.length).toBeGreaterThan(1);
  expect(heroIndex).toBeLessThan(before.length - 1); // ada ruang untuk maju

  await select(page, heroId);

  // Bring forward (Mod+]) → Hero maju satu posisi; undo mengembalikan urutan semula (satu op = satu undo).
  await page.keyboard.press("ControlOrMeta+BracketRight");
  await expect.poll(() => childrenOf(page, pageId).then((c) => c.indexOf(heroId))).toBe(heroIndex + 1);
  await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.undo.undo());
  await expect.poll(() => childrenOf(page, pageId)).toEqual(before);

  // Bring to front (Mod+Alt+]) → Hero ke akhir (paling depan).
  await page.keyboard.press("ControlOrMeta+Alt+BracketRight");
  await expect.poll(() => childrenOf(page, pageId).then((c) => c.at(-1))).toBe(heroId);

  // Send to back (Mod+Alt+[) → Hero ke indeks 0.
  await page.keyboard.press("ControlOrMeta+Alt+BracketLeft");
  await expect.poll(() => childrenOf(page, pageId).then((c) => c[0])).toBe(heroId);
});

test("AC ED-203: lock (Mod+Shift+L) & hide (Mod+Shift+H)", async ({ page }) => {
  const heroId = await idByName(page, "Hero");
  await select(page, heroId);

  await page.keyboard.press("ControlOrMeta+Shift+L");
  await expect.poll(() => fieldOf(page, heroId, "locked")).toBe(true);

  // Node terkunci tetap bisa di-hide lewat shortcut.
  await select(page, heroId);
  await page.keyboard.press("ControlOrMeta+Shift+H");
  await expect.poll(() => fieldOf(page, heroId, "visible")).toBe(false);
});
