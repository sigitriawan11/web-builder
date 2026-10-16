import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import "./support/editor";
import { firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.4.1 / T2.4.2 — ED-039/040: frame & section tool.
test.use({ locale: "en-US", storageState: OWNER_STATE });

interface DocNode {
  type: string;
  tag?: string;
  parentId: string | null;
  children?: string[];
  props?: { role?: string };
  style: {
    base: {
      size?: { width?: { value?: number }; height?: { value?: number } };
      position?: { type?: string; x?: number; y?: number };
    };
  };
}
const doc = (page: Page) => page.evaluate(() => window.__editorTestApi?.getDoc() as { nodes: Record<string, DocNode> });

test.beforeEach(async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Create Tools Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  // Kamera pas: world origin di (0,0), zoom 1 → koordinat canvas = world.
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));
});

test("AC: frame tool drag membuat frame ~300×200 di posisi kursor; kembali ke Move; node terseleksi", async ({
  page,
}) => {
  await page.getByTestId("tool-frame").click();
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");
  await page.mouse.move(box.x + 40, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 150, { steps: 4 });
  await expect(page.getByTestId("draw-preview")).toBeVisible();
  await page.mouse.move(box.x + 340, box.y + 250, { steps: 4 });
  await page.mouse.up();

  await expect(page.getByTestId("tool-select")).toHaveAttribute("aria-pressed", "true");
  const selected = await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []);
  expect(selected).toHaveLength(1);
  const frame = (await doc(page)).nodes[selected[0] as string];
  expect(frame?.type).toBe("frame");
  expect(frame?.style.base.size?.width?.value).toBe(300);
  expect(frame?.style.base.size?.height?.value).toBe(200);
  // Absolute di dalam page (page = freeform di canvas).
  expect(frame?.style.base.position).toMatchObject({ type: "absolute" });
  expect(Math.round(frame?.style.base.position?.x ?? -1)).toBe(40);
});

test("frame tool klik (tanpa drag) = 100×100 default; Esc membatalkan drawing", async ({ page }) => {
  const pageId = await firstPageId(page);
  const before = Object.keys((await doc(page)).nodes).length;
  await page.getByTestId("tool-frame").click();
  const box = await page.getByTestId("editor-canvas").boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");
  await page.mouse.click(box.x + 60, box.y + 60);
  const selected = await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []);
  expect((await doc(page)).nodes[selected[0] as string]?.style.base.size?.width?.value).toBe(100);

  // Esc saat menggambar → tidak membuat node.
  await page.getByTestId("tool-frame").click();
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 200, box.y + 200, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  expect(Object.keys((await doc(page)).nodes).length).toBe(before + 1);
  void pageId;
});

test("AC ED-040: section tool menyisipkan section > div.container di page root, index benar", async ({ page }) => {
  const pageId = await firstPageId(page);
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");

  // Dua section: klik atas lalu klik yang Y-nya lebih kecil → tersisip di index 0.
  await page.getByTestId("tool-section").click();
  await page.mouse.click(box.x + 200, box.y + 300);
  const first = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  const firstNode = (await doc(page)).nodes[first];
  expect(firstNode).toMatchObject({ type: "frame", tag: "section", props: { role: "section" } });
  // Struktur section > div.container (role container).
  const container = (await doc(page)).nodes[firstNode?.children?.[0] as string];
  expect(container).toMatchObject({ type: "frame", props: { role: "container" } });

  await page.getByTestId("tool-section").click();
  await page.mouse.click(box.x + 200, box.y + 40);
  const second = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  // Section kedua (Y lebih kecil) tersisip sebelum yang pertama.
  expect((await doc(page)).nodes[pageId]?.children).toEqual([second, first]);
});

test("AC ED-041/042: rectangle & ellipse tool → node shape; Shift = persegi; ellipse border-radius 50%", async ({
  page,
}) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Shape Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");

  // Rectangle (shortcut R) dengan Shift (persegi): drag 120×60 → 120×120.
  await canvas.click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("r");
  await expect(page.getByTestId("tool-shape")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 90, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const rectId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  const rect = (await doc(page)).nodes[rectId];
  expect(rect?.type).toBe("shape");
  expect(rect?.style.base.size?.width?.value).toBe(120);
  expect(rect?.style.base.size?.height?.value).toBe(120);
  await expect(canvas.locator(`[data-node-id="${rectId}"]`)).toHaveJSProperty("tagName", "DIV");

  // Ellipse (shortcut O): border-radius 50%.
  await page.keyboard.press("o");
  await page.mouse.move(box.x + 200, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + 320, box.y + 120, { steps: 6 });
  await page.mouse.up();
  const ellipseId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  expect((await doc(page)).nodes[ellipseId]?.type).toBe("shape");
  await expect(canvas.locator(`[data-node-id="${ellipseId}"]`)).toHaveCSS("border-radius", /50%|9999px/);
});

test("AC ED-044: text tool klik → ketik → Esc = text node auto-width dengan konten; teks kosong dihapus", async ({
  page,
}) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Text Tool Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));
  const canvas = page.getByTestId("editor-canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");
  const pageId = await firstPageId(page);
  const before = Object.keys((await doc(page)).nodes).length;

  // Klik dengan text tool → node teks auto-width, langsung mode edit.
  await page.keyboard.press("t");
  await page.mouse.click(box.x + 80, box.y + 80);
  const textId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  const node = (await doc(page)).nodes[textId];
  expect(node?.type).toBe("text");
  expect(node?.style.base.size?.width).toMatchObject({ mode: "hug" });

  const editor = canvas.locator(`[data-node-id="${textId}"] .ProseMirror`);
  await expect(editor).toBeFocused();
  await page.keyboard.type("Halo dunia");
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate((id) => {
      const docu = window.__editorTestApi?.getDoc() as
        | { nodes: Record<string, { props?: { content?: unknown } }> }
        | undefined;
      return JSON.stringify(docu?.nodes[id]?.props?.content);
    }, textId),
  ).toContain("Halo dunia");

  // Teks kosong: klik → editor fokus → Esc (Escape ditangani editor) → node dihapus (tanpa menambah jumlah).
  await page.keyboard.press("t");
  await page.mouse.click(box.x + 80, box.y + 160);
  const emptyId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  await expect(canvas.locator(`[data-node-id="${emptyId}"] .ProseMirror`)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect.poll(async () => Object.keys((await doc(page)).nodes).length).toBe(before + 1);
  void pageId;
});
