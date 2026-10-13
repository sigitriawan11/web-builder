import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator } from "./doc-helpers";

// T0.6.3 / ED-065: resize dengan 8 handle di papan freeform (zoom 100%: 1px screen = 1px world).

const CARD = "n_fcard00001"; // absolute (80, 80), 240 × 160
type YMapLike = { get(key: string): unknown };
type Spike = {
  doc: { getMap(name: string): { get(id: string): YMapLike } };
  selection: { getState(): { select(ids: string[]): void } };
};

async function open(page: Page, fixture: string, id: string, zoom = 1) {
  await page.goto(`?fixture=${fixture}&zoom=${zoom}&x=20&y=20`);
  await page.evaluate((nodeId) => (window as unknown as { __spike: Spike }).__spike.selection.getState().select([nodeId]), id);
  await expect(page.locator(".overlay-handle").first()).toBeVisible();
}

const baseStyle = (page: Page, id: string) =>
  page.evaluate((nodeId) => {
    const node = (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes").get(nodeId);
    const base = (node.get("style") as YMapLike).get("base") as YMapLike;
    return { size: base.get("size"), position: base.get("position") ?? null } as {
      size: { width?: { mode: string; value?: number }; height?: { mode: string; value?: number } };
      position: { x: number; y: number } | null;
    };
  }, id);

async function dragHandle(page: Page, handle: string, dx: number, dy: number) {
  const box = await boxOf(page.locator(`.overlay-handle[data-handle="${handle}"]`));
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 6 });
  await page.mouse.up();
}

const cases: [string, { x: number; y: number; width: number; height: number }][] = [
  ["e", { x: 80, y: 80, width: 270, height: 160 }],
  ["w", { x: 110, y: 80, width: 210, height: 160 }],
  ["s", { x: 80, y: 80, width: 240, height: 180 }],
  ["n", { x: 80, y: 100, width: 240, height: 140 }],
  ["se", { x: 80, y: 80, width: 270, height: 180 }],
  ["nw", { x: 110, y: 100, width: 210, height: 140 }],
  ["ne", { x: 80, y: 100, width: 270, height: 140 }],
  ["sw", { x: 110, y: 80, width: 210, height: 180 }],
];

for (const [handle, expected] of cases) {
  test(`handle ${handle}: geser (+30, +20) → ukuran & posisi di dokumen`, async ({ page }) => {
    await open(page, "freeform", CARD);
    await dragHandle(page, handle, 30, 20);

    const { size, position } = await baseStyle(page, CARD);
    expect({ x: position?.x, y: position?.y, width: size.width?.value, height: size.height?.value }).toEqual(expected);
  });
}

test("AC ED-065: handle kiri tidak menggeser tepi kanan (DOM, ±0.5px)", async ({ page }) => {
  await open(page, "freeform", CARD);
  const before = await boxOf(nodeLocator(page, CARD));

  await dragHandle(page, "w", -57, 0);

  const after = await boxOf(nodeLocator(page, CARD));
  expect(Math.abs(after.x + after.width - (before.x + before.width))).toBeLessThanOrEqual(0.5);
  expect(Math.round(after.width - before.width)).toBe(57);
});

test("melewati sisi berlawanan: berhenti di 1px tanpa flip, tepi kanan tetap", async ({ page }) => {
  await open(page, "freeform", CARD);
  const before = await boxOf(nodeLocator(page, CARD));

  await dragHandle(page, "w", 400, 0);

  const { size, position } = await baseStyle(page, CARD);
  expect(size.width?.value).toBe(1);
  expect(position?.x).toBe(80 + 240 - 1);
  const after = await boxOf(nodeLocator(page, CARD));
  expect(Math.abs(after.x + after.width - (before.x + before.width))).toBeLessThanOrEqual(0.5);
});

test("AC ED-065: resize anak Fill menjadi Fixed hanya di dimensi yang di-drag", async ({ page }) => {
  await open(page, "hero", "n_heroimg001", 0.5);

  await dragHandle(page, "e", -40, 0);

  const { size } = await baseStyle(page, "n_heroimg001");
  expect(size.width?.mode).toBe("fixed");
  // Tinggi tidak di-drag: tetap seperti semula (fixed 420).
  expect(size.height).toEqual({ mode: "fixed", value: 420, unit: "px" });
});
