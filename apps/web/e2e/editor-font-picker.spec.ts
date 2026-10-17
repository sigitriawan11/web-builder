import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.11.2 / ED-116: font family picker → addFont ke theme + set typography.fontFamily → canvas berubah.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const familyOf = (page: Page, id: string) =>
  page.evaluate((nid) => {
    const docu = window.__editorTestApi?.getDoc() as
      | { nodes: Record<string, { style?: { base?: { typography?: unknown } } }> }
      | undefined;
    const typography = docu?.nodes[nid]?.style?.base?.typography;
    return typography && typeof typography === "object" && "fontFamily" in typography
      ? (typography as { fontFamily?: unknown }).fontFamily
      : null;
  }, id);

const themeFonts = (page: Page) =>
  page.evaluate(() => {
    const docu = window.__editorTestApi?.getDoc() as { theme?: { fonts?: { family: string }[] } } | undefined;
    return (docu?.theme?.fonts ?? []).map((font) => font.family);
  });

test("AC ED-116: pilih font → terdaftar di theme, tersimpan di node, & font-family canvas berubah", async ({
  page,
}) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Font Picker Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");

  // Buat text node via text tool, ketik, keluar edit.
  await page.keyboard.press("t");
  await page.mouse.click(box.x + 80, box.y + 80);
  const textId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  await expect(canvas.locator(`[data-node-id="${textId}"] .ProseMirror`)).toBeFocused();
  await page.keyboard.type("Halo");
  await page.keyboard.press("Escape");
  await page.evaluate((id) => window.__editorTestApi?.select([id]), textId);

  expect(await familyOf(page, textId)).toBeNull(); // default pakai token type.body (bukan fontFamily eksplisit)

  // Buka picker → cari "Poppins" → pilih.
  await page.getByTestId("font-family").click();
  await page.getByTestId("font-search").fill("Poppins");
  await page.getByTestId("font-option-Poppins").click();

  await expect.poll(() => familyOf(page, textId)).toBe("Poppins");
  expect(await themeFonts(page)).toContain("Poppins");
  // Token type.body di-expand → ukuran/field lain tidak hilang (font-size tetap ada di typography).
  const typographyKeys = await page.evaluate((id) => {
    const docu = window.__editorTestApi?.getDoc() as {
      nodes: Record<string, { style?: { base?: { typography?: Record<string, unknown> } } }>;
    };
    return Object.keys(docu?.nodes[id]?.style?.base?.typography ?? {});
  }, textId);
  expect(typographyKeys).toContain("fontSize");

  const fontFamily = await canvas
    .locator(`[data-node-id="${textId}"]`)
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(fontFamily).toContain("Poppins");
});
