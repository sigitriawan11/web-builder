import { expect, type Page, test } from "@playwright/test";
import { idByName, nodeLocator, selectedIds } from "./doc-helpers";

// T2.16.4 / ED-206: context menu klik kanan di canvas. Klik kanan node belum terpilih → pilih dulu lalu buka menu;
// item menjalankan command yang sama dgn shortcut. Area kosong → menu aksi kanvas.

type Spike = { doc: { getMap(n: string): { get(id: string): { get(k: string): unknown } | undefined } } };
function childrenCount(page: Page, id: string): Promise<number> {
  return page.evaluate((nid) => {
    const node = (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes").get(nid);
    const kids = node?.get("children") as { length?: number } | undefined;
    return kids?.length ?? 0;
  }, id);
}
const parentOf = (page: Page, id: string) =>
  page.evaluate(
    (nid) => (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes").get(nid)?.get("parentId") as string,
    id,
  );

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=landing200&zoom=0.5&x=20&y=20");
  await expect(page.locator("[data-node-id]").first()).toBeVisible();
});

test("AC ED-206: klik kanan node → pilih + menu; Duplicate menambah sibling", async ({ page }) => {
  const heroId = await idByName(page, "Hero");
  const pageId = await parentOf(page, heroId);
  const before = await childrenCount(page, pageId);

  await nodeLocator(page, heroId).click({ button: "right" });
  await expect(page.getByTestId("canvas-context-menu")).toBeVisible();
  expect(await selectedIds(page)).toEqual([heroId]);
  await expect(page.getByTestId("ctx-edit.copy")).toBeVisible();
  await expect(page.getByTestId("ctx-edit.delete")).toBeVisible();

  await page.getByTestId("ctx-edit.duplicate").click();
  await expect(page.getByTestId("canvas-context-menu")).toHaveCount(0);
  await expect.poll(() => childrenCount(page, pageId)).toBe(before + 1);
});

test("klik kanan node → Delete menghapusnya", async ({ page }) => {
  const heroId = await idByName(page, "Hero");
  const pageId = await parentOf(page, heroId);
  const before = await childrenCount(page, pageId);

  await nodeLocator(page, heroId).click({ button: "right" });
  await page.getByTestId("ctx-edit.delete").click();

  await expect.poll(() => childrenCount(page, pageId)).toBe(before - 1);
  await expect(nodeLocator(page, heroId)).toHaveCount(0);
});
