import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.11.1 / ED-115: inline text editing (Tiptap) — satu sesi edit = satu langkah undo.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const contentText = (page: Page, id: string) =>
  page.evaluate((nid) => {
    const docu = window.__editorTestApi?.getDoc() as
      | { nodes: Record<string, { props?: { content?: unknown } }> }
      | undefined;
    return JSON.stringify(docu?.nodes[nid]?.props?.content ?? null);
  }, id);

test("AC ED-115: satu sesi edit teks = satu langkah undo (bukan per karakter)", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Text Editing Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");

  // Text tool → klik → masuk mode edit → ketik beberapa karakter → Esc (satu sesi edit).
  await page.keyboard.press("t");
  await page.mouse.click(box.x + 80, box.y + 80);
  const textId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  await expect(canvas.locator(`[data-node-id="${textId}"] .ProseMirror`)).toBeFocused();
  await page.keyboard.type("Halo dunia");
  await page.keyboard.press("Escape");
  expect(await contentText(page, textId)).toContain("Halo dunia");

  // Undo sekali → seluruh ketikan sesi itu hilang dalam SATU langkah (kalau per karakter, "Halo" masih tersisa).
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(() => contentText(page, textId)).not.toContain("Halo");
});

test("AC ED-121: ketik '- ' → bullet list; dirender <ul><li>", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "List Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");

  await page.keyboard.press("t");
  await page.mouse.click(box.x + 80, box.y + 80);
  const textId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  await expect(canvas.locator(`[data-node-id="${textId}"] .ProseMirror`)).toBeFocused();
  // Input rule StarterKit: "- " di awal baris → bullet list.
  await page.keyboard.type("- Satu");
  await expect(canvas.locator(`[data-node-id="${textId}"] ul li`)).toHaveText("Satu");
  await page.keyboard.press("Escape");

  expect(await contentText(page, textId)).toContain("bulletList");
});

test("AC ED-125: bubble toolbar pada seleksi teks → toggle bold", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Bubble Toolbar Test")}`);
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
  // Pilih seluruh teks baris → bubble toolbar muncul.
  await page.keyboard.press("Shift+Home");
  await expect(page.getByTestId("text-bubble-toolbar")).toBeVisible();

  await page.getByTestId("mark-bold").click();
  await page.keyboard.press("Escape");
  expect(await contentText(page, textId)).toContain("bold");
});
