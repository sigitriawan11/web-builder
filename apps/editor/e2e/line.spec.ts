import { expect, type Page, test } from "@playwright/test";

// T2.4.5 / ED-043: line tool (L). Drag A→B → node shape "line" (div tipis). Orientasi dari sumbu dominan drag;
// di auto-layout, garis horizontal memakai width Fill (divider responsif, AC).
type NodeJson = {
  type?: string;
  props?: { shape?: string };
  style?: { base?: { size?: { width?: { mode?: string } } } };
};
type Spike = {
  doc: { getMap(name: string): { get(id: string): { toJSON(): NodeJson } | undefined } };
  selection: { getState(): { selectedIds: string[] } };
};

const selectedId = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.selection.getState().selectedIds[0] ?? "");

const nodeJson = (page: Page, id: string): Promise<NodeJson> =>
  page.evaluate(
    (nid) => (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes").get(nid)?.toJSON() ?? {},
    id,
  );

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=hero&zoom=1&x=0&y=0");
  await expect(page.locator('[data-node-id="n_heroimg001"]')).toBeVisible();
});

test("AC ED-043: line tool L + drag horizontal → node shape line, orientasi horizontal", async ({ page }) => {
  await page.keyboard.press("l");
  // Gambar garis horizontal di dalam konten hero.
  await page.mouse.move(320, 430);
  await page.mouse.down();
  await page.mouse.move(540, 433, { steps: 6 });
  await page.mouse.up();

  const id = await selectedId(page);
  expect(id).not.toBe("");
  const n1 = await nodeJson(page, id);
  expect(n1.type).toBe("shape");
  expect(n1.props?.shape).toBe("line");

  // Ter-render sebagai div tipis horizontal (lebar >> tinggi).
  const box = await page.locator(`[data-node-id="${id}"]`).boundingBox();
  if (!box) throw new Error("garis tidak terlihat");
  expect(box.width).toBeGreaterThan(box.height);
});

test("AC ED-043: garis horizontal di auto-layout kolom → width Fill (divider responsif)", async ({ page }) => {
  await page.goto("?fixture=autolayout&zoom=1&x=0&y=0");
  const col = await page.locator('[data-node-id="n_alcol00001"]').boundingBox();
  if (!col) throw new Error("kolom tidak terlihat");

  await page.keyboard.press("l");
  // Gambar di area padding atas kolom (di atas anak pertama) → parent = kolom (flex) → divider.
  const y = col.y + 6;
  await page.mouse.move(col.x + 16, y);
  await page.mouse.down();
  await page.mouse.move(col.x + col.width - 16, y + 2, { steps: 6 });
  await page.mouse.up();

  const id = await selectedId(page);
  expect(id).not.toBe("");
  const n2 = await nodeJson(page, id);
  expect(n2.props?.shape).toBe("line");
  // Divider responsif: width Fill (AC ED-043).
  expect(n2.style?.base?.size?.width?.mode).toBe("fill");
});
