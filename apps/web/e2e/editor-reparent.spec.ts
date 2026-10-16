import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.6.1 / ED-063: keluar auto-layout ke parent freeform → node jadi absolute di posisi visualnya (keepVisualPosition).
test.use({ locale: "en-US", storageState: OWNER_STATE });

interface DocNode {
  type: string;
  parentId: string | null;
  children?: string[];
  style: { base: { position?: { type?: string; x?: number; y?: number } } };
}
const doc = (page: Page) => page.evaluate(() => window.__editorTestApi?.getDoc() as { nodes: Record<string, DocNode> });

async function create(page: Page, args: Record<string, unknown>): Promise<string> {
  const result = await editorCommand(page, "createNode", args);
  expect(result.ok).toBe(true);
  return String(result.value);
}

test("AC ED-063: drag anak flex keluar ke page freeform → absolute keepVisualPosition", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Reparent Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  const sizeFixed = (w: number, h: number) => ({
    width: { mode: "fixed" as const, value: w, unit: "px" as const },
    height: { mode: "fixed" as const, value: h, unit: "px" as const },
  });
  // Frame auto-layout (row) di page freeform.
  const flex = await create(page, {
    parentId: pageId,
    type: "frame",
    style: {
      base: {
        layout: { mode: "flex", direction: "row", gap: { value: 10, unit: "px" } },
        position: { type: "absolute", x: 60, y: 60 },
        size: sizeFixed(320, 100),
      },
    },
  });
  // Frame freeform (non-flex, ukuran tetap) sebagai tujuan drop → bisa di-hit test.
  const freeform = await create(page, {
    parentId: pageId,
    type: "frame",
    style: {
      base: { layout: { mode: "none" }, position: { type: "absolute", x: 60, y: 240 }, size: sizeFixed(320, 220) },
    },
  });
  const a = await create(page, { parentId: flex, type: "frame", style: { base: { size: sizeFixed(100, 60) } } });
  const b = await create(page, { parentId: flex, type: "frame", style: { base: { size: sizeFixed(100, 60) } } });

  // A & B anak flow dari flex.
  expect((await doc(page)).nodes[flex]?.children).toEqual([a, b]);
  expect((await doc(page)).nodes[a]?.style.base.position).toBeUndefined();

  const box = await page.getByTestId("editor-canvas").boundingBox();
  if (!box) throw new Error("canvas tidak terlihat");
  const geo = await page.evaluate((id) => window.__editorTestApi?.getGeometry(id) ?? null, a);
  if (!geo) throw new Error("geometri A tidak ada");

  // Pilih A lalu seret ke tengah frame freeform (world ~ (220, 350)).
  await page.evaluate((id) => window.__editorTestApi?.select([id]), a);
  await page.mouse.move(box.x + geo.x + geo.width / 2, box.y + geo.y + geo.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 350, { steps: 10 });
  // Ghost tampil, tanpa marker (drop ke freeform, bukan reorder).
  await expect(page.locator(".overlay-reorder-ghost")).toBeVisible();
  await expect(page.locator(".overlay-insertion-marker")).toHaveCount(0);
  await page.mouse.up();

  const after = await doc(page);
  expect(after.nodes[flex]?.children).toEqual([b]);
  expect(after.nodes[a]?.parentId).toBe(freeform);
  expect(after.nodes[a]?.style.base.position?.type).toBe("absolute");
  expect(after.nodes[freeform]?.children).toContain(a);
  // keepVisualPosition: posisi lokal relatif frame freeform (>0, bukan di titik asal di flex).
  expect(after.nodes[a]?.style.base.position?.y ?? -1).toBeGreaterThan(0);
});
