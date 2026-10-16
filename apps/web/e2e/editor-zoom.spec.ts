import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.2.1 / ED-028: zoom to fit, zoom to selection, 100%, zoom bertahap.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const camera = (page: Page) => page.evaluate(() => window.__editorTestApi?.getCamera());

async function openEditor(page: Page) {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Zoom Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.getByTestId("editor-canvas").click({ position: { x: 5, y: 5 } });
}

test.describe("tanpa animasi (prefers-reduced-motion)", () => {
  test.use({ reducedMotion: "reduce" });

  test("AC: Shift+1 pada page kosong → 100% di origin; Shift+2 node 4×4 → ≤ 400%; Shift+0 / Mod+0 → 100%", async ({
    page,
  }) => {
    await openEditor(page);
    await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 300, y: 120, zoom: 0.37 }));
    await page.keyboard.press("Shift+Digit1");
    expect(await camera(page)).toEqual({ x: 0, y: 0, zoom: 1 });

    const pageId = await firstPageId(page);
    const size = { width: { mode: "fixed", value: 4, unit: "px" }, height: { mode: "fixed", value: 4, unit: "px" } };
    const tiny = String(
      (await editorCommand(page, "createNode", { parentId: pageId, type: "frame", style: { base: { size } } })).value,
    );
    await page.evaluate((id) => window.__editorTestApi?.select([id]), tiny);
    await page.keyboard.press("Shift+Digit2");
    expect((await camera(page))?.zoom).toBe(4);

    // Konten ada → fit memuat page (zoom < 1 untuk frame 1440 px).
    await page.keyboard.press("Shift+Digit1");
    expect((await camera(page))?.zoom).toBeLessThan(1);

    await page.keyboard.press("Shift+Digit0");
    expect((await camera(page))?.zoom).toBe(1);
    await page.evaluate(() => window.__editorTestApi?.setCamera({ zoom: 0.5 }));
    await page.keyboard.press("Control+Digit0");
    expect((await camera(page))?.zoom).toBe(1);

    // Zoom bertahap Mod+= / Mod+- (preset ED-027).
    await page.keyboard.press("Control+Equal");
    expect((await camera(page))?.zoom).toBe(1.5);
    await page.keyboard.press("Control+Minus");
    expect((await camera(page))?.zoom).toBe(1);
  });
});

test("transisi kamera dianimasikan (~200 ms) lalu berhenti tepat di target", async ({ page }) => {
  await openEditor(page);
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 0.25 }));
  const samples = await page.evaluate(async () => {
    const values: number[] = [];
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit0", shiftKey: true, bubbles: true }));
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      values.push(window.__editorTestApi?.getCamera().zoom ?? 0);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    values.push(window.__editorTestApi?.getCamera().zoom ?? 0);
    return values;
  });
  // Ada nilai antara (bukan langsung lompat) dan nilai akhir tepat 100%.
  expect(samples.some((zoom) => zoom > 0.25 && zoom < 1)).toBe(true);
  expect(samples.at(-1)).toBe(1);
});
