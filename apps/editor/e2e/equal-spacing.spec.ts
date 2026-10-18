import { expect, test } from "@playwright/test";
import { boxOf, nodeLocator } from "./doc-helpers";

// T2.7.4 / ED-077: equal-spacing snapping. Tiga kotak dapat diatur berjarak sama hanya dengan drag & snap.
// (Math murni: unit test equal-spacing; di sini integrasi drag end-to-end.)
type Spike = {
  doc: { getMap(name: string): { keys(): Iterable<string>; get(id: string): { get(key: string): unknown } } };
  ops: { createNode: unknown };
  run(op: unknown, input: unknown): { ok: boolean; value?: string };
};

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=freeform&zoom=1&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
});

test("AC ED-077: drag kotak tengah → snap ke jarak sama antara dua kotak", async ({ page }) => {
  // Buat 3 kotak absolute sejajar: b1 x0, b3 x300 (kandidat), b2 x170 (digeser ke tengah = x150).
  const ids = await page.evaluate(() => {
    const spike = (window as unknown as { __spike: Spike }).__spike;
    const nodes = spike.doc.getMap("nodes");
    let pageId = "";
    for (const id of nodes.keys()) if (nodes.get(id).get("type") === "page") pageId = id;
    const make = (x: number) =>
      spike.run(spike.ops.createNode, {
        parentId: pageId,
        type: "shape",
        props: { shape: "rect" },
        style: {
          base: {
            size: {
              width: { mode: "fixed", value: 100, unit: "px" },
              height: { mode: "fixed", value: 100, unit: "px" },
            },
            position: { type: "absolute", x, y: 260 },
            fills: [{ type: "solid", color: "#88AACC" }],
          },
        },
      }).value as string;
    return { b1: make(0), b2: make(170), b3: make(300) };
  });

  // Seret b2 dari pusatnya ke ~x150 (dalam ambang snap) → snap ke jarak sama.
  await expect(nodeLocator(page, ids.b2)).toBeVisible();
  const before = await boxOf(nodeLocator(page, ids.b2));
  const cx = before.x + before.width / 2;
  const cy = before.y + before.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  // Geser kiri 18px → world x ≈ 152, snap menarik ke 150 (gap kiri = gap kanan = 50).
  await page.mouse.move(cx - 18, cy, { steps: 6 });
  await page.mouse.up();

  const positionX = (id: string) =>
    page.evaluate((nid) => {
      const node = (window as unknown as { __spike: Spike }).__spike.doc.getMap("nodes").get(nid);
      const base = (node.get("style") as { get(k: string): unknown }).get("base") as { get(k: string): unknown };
      return (base.get("position") as { x: number }).x;
    }, id);

  expect(await positionX(ids.b2)).toBe(150);
});
