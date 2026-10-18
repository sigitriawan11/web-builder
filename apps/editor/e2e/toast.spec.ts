import { expect, type Page, test } from "@playwright/test";
import { idByName } from "./doc-helpers";

// T2.20.2 / ED-228: aksi/command yang ditolak memunculkan toast (feedback). Contoh reproducible: wrap-in-frame
// (Mod+Alt+G) pada seleksi lintas-parent ditolak → toast peringatan.

type Spike = { selection: { getState(): { select(ids: readonly string[]): void } } };
const select = (page: Page, ids: string[]) =>
  page.evaluate((list) => (window as unknown as { __spike: Spike }).__spike.selection.getState().select(list), ids);

test("AC ED-228: command ditolak (wrap lintas-parent) → toast", async ({ page }) => {
  await page.goto("?fixture=landing200&zoom=0.5&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  await expect(page.locator("[data-node-id]").first()).toBeVisible();

  // Dua node dengan parent berbeda (judul di dalam Hero vs section Fitur 1 di page).
  const deep = await idByName(page, "Hero / Title");
  const section = await idByName(page, "Fitur 1");
  await select(page, [deep, section]);

  await expect(page.getByTestId("toasts")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+Alt+KeyG");
  await expect(page.getByTestId("toasts")).toBeVisible();
});
