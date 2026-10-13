import { expect, test } from "@playwright/test";
import { idByName, idsByName, nodeLocator, selectedIds } from "./doc-helpers";

// T0.5.4 / ED-038, ED-051: select tool & aturan kedalaman klik di fixture landing.

const selected = selectedIds;
const node = nodeLocator;

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=landing200&zoom=0.5&x=20&y=20");
  await expect(page.locator("[data-node-id]").first()).toBeVisible();
});

test("AC ED-051: klik judul hero → section Hero; double-click turun ke container sampai teks; lalu edit", async ({ page }) => {
  const id = await idsByName(page, ["Hero", "Hero / Row", "Hero / Copy", "Hero / Title"]);
  const [hero, row, copy, title] = [id.Hero, id["Hero / Row"], id["Hero / Copy"], id["Hero / Title"]];

  await node(page, title).click();
  expect(await selected(page)).toEqual([hero]);

  await node(page, title).dblclick();
  expect(await selected(page)).toEqual([row]);
  await node(page, title).dblclick();
  expect(await selected(page)).toEqual([copy]);
  await node(page, title).dblclick();
  expect(await selected(page)).toEqual([title]);

  await node(page, title).dblclick();
  await expect(page.locator(`[data-node-id="${title}"] .ProseMirror`)).toBeFocused();
});

test("setelah masuk, klik saudara memilih saudara; klik section lain memilih section itu", async ({ page }) => {
  const id = await idsByName(page, ["Hero", "Hero / Row", "Hero / Copy", "Hero / Photo", "Fitur 1"]);
  const [hero, row, copy, photo, feature] = [id.Hero, id["Hero / Row"], id["Hero / Copy"], id["Hero / Photo"], id["Fitur 1"]];

  await node(page, photo).dblclick();
  expect(await selected(page)).toEqual([row]);
  await node(page, photo).dblclick();
  expect(await selected(page)).toEqual([photo]);

  await node(page, copy).click({ position: { x: 4, y: 4 } });
  expect(await selected(page)).toEqual([copy]);

  await node(page, feature).click({ position: { x: 4, y: 4 } });
  expect(await selected(page)).toEqual([feature]);
  expect(await selected(page)).not.toContain(hero);
});

test("klik di area kosong canvas mengosongkan seleksi", async ({ page }) => {
  const hero = await idByName(page, "Hero");
  await node(page, hero).click({ position: { x: 4, y: 4 } });
  expect(await selected(page)).toEqual([hero]);

  await page.mouse.click(1200, 400);

  expect(await selected(page)).toEqual([]);
});

test("seleksi ditampilkan sebagai outline yang menempel pada node", async ({ page }) => {
  const hero = await idByName(page, "Hero");
  await node(page, hero).click({ position: { x: 4, y: 4 } });

  const outline = page.locator(".overlay-selection-outline");
  await expect(outline).toHaveCount(1);
  const [outlineBox, heroBox] = await Promise.all([outline.boundingBox(), node(page, hero).boundingBox()]);
  expect(Math.abs((outlineBox?.width ?? 0) - (heroBox?.width ?? 0))).toBeLessThanOrEqual(0.5);
  expect(Math.abs((outlineBox?.y ?? 0) - (heroBox?.y ?? 0))).toBeLessThanOrEqual(0.5);
});

test("AC ED-047: klik dengan hand tool tidak mengubah seleksi", async ({ page }) => {
  const id = await idsByName(page, ["Hero", "Fitur 1"]);
  const [hero, feature] = [id.Hero, id["Fitur 1"]];
  await node(page, hero).click({ position: { x: 4, y: 4 } });

  await page.keyboard.press("KeyH");
  // Bukan di pojok: sudut kiri-atas Fitur 1 berimpit dengan handle sudut Hero yang sedang terseleksi.
  await node(page, feature).click({ position: { x: 40, y: 40 } });
  await page.mouse.click(1200, 400);

  expect(await selected(page)).toEqual([hero]);
});
