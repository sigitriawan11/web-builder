import { expect, type Page, test } from "@playwright/test";
import { idByName } from "./doc-helpers";

// T2.16.3 / ED-204: command palette. Mod+/ selalu membuka; Mod+K membuka hanya tanpa seleksi. Pencarian bilingual
// (satu item untuk perintah meski judul ID+EN). "Ke layer" memilih node.

type Spike = { selection: { getState(): { select(ids: readonly string[]): void; selectedIds: readonly string[] } } };
const select = (page: Page, id: string) =>
  page.evaluate((nid) => (window as unknown as { __spike: Spike }).__spike.selection.getState().select([nid]), id);
const selectedIds = (page: Page) =>
  page.evaluate(() => [...(window as unknown as { __spike: Spike }).__spike.selection.getState().selectedIds]);

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=landing200&zoom=0.5&x=20&y=20");
  await expect(page.locator("[data-node-id]").first()).toBeVisible();
});

test("AC ED-204: Mod+/ buka palette; ketik 'auto' → satu item add-auto-layout (bilingual); Esc tutup", async ({
  page,
}) => {
  await select(page, await idByName(page, "Hero"));
  await page.keyboard.press("ControlOrMeta+Slash");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await expect(page.getByTestId("command-palette-input")).toBeFocused();

  await page.getByTestId("command-palette-input").fill("auto");
  // Satu item saja untuk "Add auto layout" / "Tambah auto layout" (judul ID & EN = satu entri).
  await expect(page.getByTestId("command-palette-item").filter({ hasText: /(Add|Tambah) auto layout/i })).toHaveCount(
    1,
  );

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("command-palette")).toHaveCount(0);
});

test("Mod+K membuka palette hanya tanpa seleksi", async ({ page }) => {
  // Ada seleksi → Mod+K = Add link (bukan palette).
  await select(page, await idByName(page, "Hero"));
  await page.keyboard.press("ControlOrMeta+KeyK");
  await expect(page.getByTestId("command-palette")).toHaveCount(0);

  // Tanpa seleksi → Mod+K membuka palette.
  await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.selection.getState().select([]));
  await page.keyboard.press("ControlOrMeta+KeyK");
  await expect(page.getByTestId("command-palette")).toBeVisible();
});

test("AC ED-204: 'Ke layer' memilih node", async ({ page }) => {
  const featureId = await idByName(page, "Fitur 1");
  await page.keyboard.press("ControlOrMeta+Slash");
  await expect(page.getByTestId("command-palette")).toBeVisible();

  await page.getByTestId("command-palette-input").fill("Fitur 1");
  await page.getByTestId("command-palette-item").filter({ hasText: "Fitur 1" }).first().click();

  await expect(page.getByTestId("command-palette")).toHaveCount(0);
  expect(await selectedIds(page)).toEqual([featureId]);
});
