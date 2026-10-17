import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import "./support/editor";
import { editorCommand } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.11.3 / ED-117: weight, size, line height, letter spacing.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const typographyOf = (page: Page, id: string) =>
  page.evaluate((nid) => {
    const docu = window.__editorTestApi?.getDoc() as
      | { nodes: Record<string, { style?: { base?: { typography?: Record<string, unknown> } } }> }
      | undefined;
    return docu?.nodes[nid]?.style?.base?.typography ?? null;
  }, id);

test("AC ED-117: ubah size & weight → tersimpan di node & tercermin di canvas", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Typography Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");

  await page.keyboard.press("t");
  await page.mouse.click(box.x + 80, box.y + 80);
  const textId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  await expect(canvas.locator(`[data-node-id="${textId}"] .ProseMirror`)).toBeFocused();
  await page.keyboard.type("Halo");
  await page.keyboard.press("Escape");
  await page.evaluate((id) => window.__editorTestApi?.select([id]), textId);

  // Ukuran font → 32px.
  await page.getByTestId("font-size").fill("32");
  await page.getByTestId("font-size").press("Enter");
  await expect
    .poll(async () => (await typographyOf(page, textId)) as { fontSize?: { value?: number } })
    .toMatchObject({
      fontSize: { value: 32, unit: "px" },
    });

  // Weight → 700.
  await page.getByTestId("font-weight").selectOption("700");
  await expect.poll(async () => ((await typographyOf(page, textId)) as { fontWeight?: number })?.fontWeight).toBe(700);

  // Canvas mencerminkan perubahan.
  const styles = await canvas.locator(`[data-node-id="${textId}"]`).evaluate((element) => {
    const computed = getComputedStyle(element);
    return { fontSize: computed.fontSize, fontWeight: computed.fontWeight };
  });
  expect(styles.fontSize).toBe("32px");
  expect(styles.fontWeight).toBe("700");
});

test("AC ED-119: alignment horizontal (text-align) & vertikal (fixed height 200 → tengah)", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Text Align Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");

  await page.keyboard.press("t");
  await page.mouse.click(box.x + 80, box.y + 80);
  const textId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  await expect(canvas.locator(`[data-node-id="${textId}"] .ProseMirror`)).toBeFocused();
  await page.keyboard.type("Halo");
  await page.keyboard.press("Escape");
  // Tinggi tetap 200 agar perataan vertikal terlihat.
  await editorCommand(page, "updateStyle", {
    ids: [textId],
    patch: { size: { height: { mode: "fixed", value: 200, unit: "px" } } },
  });
  await page.evaluate((id) => window.__editorTestApi?.select([id]), textId);

  // Vertical middle.
  await page.getByTestId("talign-middle").click();
  const node = canvas.locator(`[data-node-id="${textId}"]`);
  await expect(node).toHaveCSS("justify-content", "center");
  await expect(node).toHaveCSS("flex-direction", "column");

  // Horizontal center.
  await page.getByTestId("talign-center").click();
  await expect(node).toHaveCSS("text-align", "center");
});
