import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.5.1 / T2.5.2 — ED-052 (multi-select Shift+klik toggle) & ED-054 (deep select Mod+klik).
test.use({ locale: "en-US", storageState: OWNER_STATE });

const absFrame = (x: number, y: number, width: number, height: number) => ({
  base: {
    layout: { mode: "none" as const },
    position: { type: "absolute" as const, x, y },
    size: {
      width: { mode: "fixed" as const, value: width, unit: "px" as const },
      height: { mode: "fixed" as const, value: height, unit: "px" as const },
    },
  },
});

async function createFrame(
  page: Page,
  parentId: string,
  rect: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const result = await editorCommand(page, "createNode", {
    parentId,
    type: "frame",
    style: absFrame(rect.x, rect.y, rect.width, rect.height),
  });
  expect(result.ok).toBe(true);
  return String(result.value);
}

const selection = (page: Page) => page.evaluate(() => window.__editorTestApi?.getSelection() ?? []);

/** Klik tengah node (world → layar via kamera origin/zoom 1) dengan modifier opsional. */
async function clickNodeCenter(page: Page, nodeId: string, modifier?: "Shift" | "Control"): Promise<void> {
  const box = await page.getByTestId("editor-canvas").boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");
  const geo = await page.evaluate((id) => window.__editorTestApi?.getGeometry(id) ?? null, nodeId);
  if (!geo) throw new Error(`geometri node ${nodeId} tidak ada`);
  const x = box.x + geo.x + geo.width / 2;
  const y = box.y + geo.y + geo.height / 2;
  if (modifier) await page.keyboard.down(modifier);
  await page.mouse.click(x, y);
  if (modifier) await page.keyboard.up(modifier);
}

async function openEditor(page: Page, name: string): Promise<void> {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, name)}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  // Kamera origin, zoom 1 → koordinat world = koordinat canvas.
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));
}

test("AC ED-052: Shift+klik toggle multi-select & bounding gabungan", async ({ page }) => {
  await openEditor(page, "Selection Toggle");
  const pageId = await firstPageId(page);
  const f1 = await createFrame(page, pageId, { x: 40, y: 40, width: 120, height: 120 });
  const f2 = await createFrame(page, pageId, { x: 220, y: 40, width: 120, height: 120 });

  // Klik F1 → hanya F1.
  await clickNodeCenter(page, f1);
  expect(await selection(page)).toEqual([f1]);

  // Shift+klik F2 → F1 & F2 (bounding gabungan: overlay tunggal mencakup keduanya).
  await clickNodeCenter(page, f2, "Shift");
  expect([...(await selection(page))].sort()).toEqual([f1, f2].sort());

  // Shift+klik F1 lagi → toggle keluar, sisa F2.
  await clickNodeCenter(page, f1, "Shift");
  expect(await selection(page)).toEqual([f2]);
});

test("AC ED-055: Enter pilih anak, Shift+Enter pilih parent (page root di ujung), Tab sibling wrap", async ({
  page,
}) => {
  await openEditor(page, "Selection Nav");
  const pageId = await firstPageId(page);
  const parent = await createFrame(page, pageId, { x: 40, y: 40, width: 400, height: 300 });
  const a = await createFrame(page, parent, { x: 20, y: 20, width: 120, height: 80 });
  const b = await createFrame(page, parent, { x: 160, y: 20, width: 120, height: 80 });

  // Enter pada parent → pilih semua anak langsung.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), parent);
  await page.keyboard.press("Enter");
  expect([...(await selection(page))].sort()).toEqual([a, b].sort());

  // Shift+Enter pada anak → parent; lanjut → page root; di page root tidak berubah.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), a);
  await page.keyboard.press("Shift+Enter");
  expect(await selection(page)).toEqual([parent]);
  await page.keyboard.press("Shift+Enter");
  expect(await selection(page)).toEqual([pageId]);
  await page.keyboard.press("Shift+Enter");
  expect(await selection(page)).toEqual([pageId]);

  // Tab / Shift+Tab berpindah sibling dengan wrap-around.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), a);
  await page.keyboard.press("Tab");
  expect(await selection(page)).toEqual([b]);
  await page.keyboard.press("Tab");
  expect(await selection(page)).toEqual([a]);
  await page.keyboard.press("Shift+Tab");
  expect(await selection(page)).toEqual([b]);
});

const nodeField = (page: Page, id: string, field: "locked" | "visible") =>
  page.evaluate(
    ({ id, field }) => {
      const docu = window.__editorTestApi?.getDoc() as
        | { nodes: Record<string, { locked?: boolean; visible?: boolean }> }
        | undefined;
      return docu?.nodes[id]?.[field];
    },
    { id, field },
  );

test("AC ED-059: Mod+Shift+L kunci (tak bisa diklik di canvas) & Mod+Shift+H sembunyikan", async ({ page }) => {
  await openEditor(page, "Lock Hide");
  const pageId = await firstPageId(page);
  const frame = await createFrame(page, pageId, { x: 40, y: 40, width: 200, height: 160 });
  const canvas = page.getByTestId("editor-canvas");

  // Klik memilih frame, lalu Mod+Shift+L mengunci.
  await clickNodeCenter(page, frame);
  expect(await selection(page)).toEqual([frame]);
  await page.keyboard.press("ControlOrMeta+Shift+KeyL");
  expect(await nodeField(page, frame, "locked")).toBe(true);

  // Node terkunci tidak bisa dipilih lewat klik canvas (klik → latar → seleksi kosong).
  await page.evaluate(() => window.__editorTestApi?.select([]));
  await clickNodeCenter(page, frame);
  expect(await selection(page)).toEqual([]);

  // Masih bisa dipilih "lewat layers" (API) → Mod+Shift+L membuka kunci; klik canvas berfungsi lagi.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);
  await page.keyboard.press("ControlOrMeta+Shift+KeyL");
  expect(await nodeField(page, frame, "locked")).toBe(false);
  await page.evaluate(() => window.__editorTestApi?.select([]));
  await clickNodeCenter(page, frame);
  expect(await selection(page)).toEqual([frame]);

  // Mod+Shift+H menyembunyikan (hidden di editor, tetap terseleksi); lagi → tampil.
  await page.keyboard.press("ControlOrMeta+Shift+KeyH");
  expect(await nodeField(page, frame, "visible")).toBe(false);
  expect(await selection(page)).toEqual([frame]);
  await expect(canvas.locator(`[data-node-id="${frame}"]`)).toBeHidden();
  await page.keyboard.press("ControlOrMeta+Shift+KeyH");
  expect(await nodeField(page, frame, "visible")).toBe(true);
  await expect(canvas.locator(`[data-node-id="${frame}"]`)).toBeVisible();
});

test("AC ED-056: Mod+A memilih semua sibling dalam konteks (grid), tanpa seleksi = section page root", async ({
  page,
}) => {
  await openEditor(page, "Select All");
  const pageId = await firstPageId(page);
  const grid = await createFrame(page, pageId, { x: 40, y: 40, width: 400, height: 300 });
  const card1 = await createFrame(page, grid, { x: 20, y: 20, width: 120, height: 80 });
  const card2 = await createFrame(page, grid, { x: 160, y: 20, width: 120, height: 80 });
  const card3 = await createFrame(page, grid, { x: 20, y: 120, width: 120, height: 80 });

  // Satu card terpilih → Mod+A memilih semua card di grid.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), card1);
  await page.keyboard.press("ControlOrMeta+a");
  expect([...(await selection(page))].sort()).toEqual([card1, card2, card3].sort());

  // Tanpa seleksi → semua section top-level (anak page root). Di sini hanya `grid`.
  await page.evaluate(() => window.__editorTestApi?.select([]));
  await page.keyboard.press("ControlOrMeta+a");
  expect(await selection(page)).toEqual([grid]);
  void pageId;
});

test("AC ED-054: Mod+klik memilih node terdalam langsung", async ({ page }) => {
  await openEditor(page, "Deep Select");
  const pageId = await firstPageId(page);
  const parent = await createFrame(page, pageId, { x: 40, y: 40, width: 280, height: 200 });
  const child = await createFrame(page, parent, { x: 20, y: 20, width: 220, height: 140 });
  const grandchild = await createFrame(page, child, { x: 20, y: 20, width: 160, height: 90 });

  // Klik biasa di area grandchild → aturan kedalaman memilih parent top-level dulu (ED-051).
  await clickNodeCenter(page, grandchild);
  expect(await selection(page)).toEqual([parent]);

  // Mod+klik di titik yang sama → langsung node terdalam (grandchild), abaikan kedalaman.
  await clickNodeCenter(page, grandchild, "Control");
  expect(await selection(page)).toEqual([grandchild]);
});
