import { expect, type Locator, type Page, test } from "@playwright/test";

// T0.5.1 / ED-019: rect world dari geometry store harus cocok dengan bounding box DOM ±0.5px.

type Spike = {
  run: (op: unknown, input: unknown) => { ok: boolean };
  ops: Record<string, unknown>;
  camera: { getState(): { setCamera(next: { x?: number; y?: number; zoom?: number }): void } };
};

const IMAGE = '[data-node-id="n_heroimg001"]';
const OUTLINE = ".overlay-geometry-outline";

async function expectOutlineOn(page: Page, target: Locator) {
  await expect
    .poll(async () => {
      const [outline, node] = await Promise.all([page.locator(OUTLINE).boundingBox(), target.boundingBox()]);
      if (!outline || !node) return Number.POSITIVE_INFINITY;
      return Math.max(
        Math.abs(outline.x - node.x),
        Math.abs(outline.y - node.y),
        Math.abs(outline.width - node.width),
        Math.abs(outline.height - node.height),
      );
    })
    .toBeLessThanOrEqual(0.5);
}

const runCommand = (page: Page, op: string, input: unknown) =>
  page.evaluate(
    ({ name, payload }) => {
      const spike = (window as unknown as { __spike: Spike }).__spike;
      return spike.run(spike.ops[name], payload);
    },
    { name: op, payload: input },
  );

for (const zoom of [0.5, 1, 2]) {
  test(`outline geometry menempel pada elemen di zoom ${zoom * 100}%`, async ({ page }) => {
    await page.goto(`?fixture=hero&outline=n_heroimg001&zoom=${zoom}&x=20&y=-${(zoom - 0.5) * 300}`);
    await expectOutlineOn(page, page.locator(IMAGE));
  });
}

test("node di-resize: ResizeObserver memperbarui rect", async ({ page }) => {
  await page.goto("?fixture=hero&outline=n_heroimg001&zoom=0.5&x=20&y=20");
  await expectOutlineOn(page, page.locator(IMAGE));

  await runCommand(page, "updateStyle", {
    ids: ["n_heroimg001"],
    patch: { size: { height: { mode: "fixed", value: 200, unit: "px" } } },
  });

  await expect(page.locator(IMAGE)).toHaveCSS("height", "200px");
  await expectOutlineOn(page, page.locator(IMAGE));
});

test("node bergeser tanpa berubah ukuran: transaksi dokumen memicu ukur ulang", async ({ page }) => {
  await page.goto("?fixture=hero&outline=n_heroimg001&zoom=0.5&x=20&y=20");
  await expectOutlineOn(page, page.locator(IMAGE));
  const before = await page.locator(IMAGE).boundingBox();

  await runCommand(page, "moveNode", { id: "n_heroimg001", newParentId: "n_hero000001", index: 0 });

  await expect.poll(async () => (await page.locator(IMAGE).boundingBox())?.y).not.toBe(before?.y);
  await expectOutlineOn(page, page.locator(IMAGE));
});

test("pan & zoom tidak perlu ukur ulang: outline tetap menempel", async ({ page }) => {
  await page.goto("?fixture=hero&outline=n_heroimg001&zoom=0.5&x=20&y=20");
  await expectOutlineOn(page, page.locator(IMAGE));

  await page.evaluate(() =>
    (window as unknown as { __spike: Spike }).__spike.camera.getState().setCamera({ x: -300, y: -100, zoom: 1.5 }),
  );

  await expectOutlineOn(page, page.locator(IMAGE));
});

test("mode 3 frame: geometry mengukur node di frame Desktop", async ({ page }) => {
  await page.goto("?fixture=hero&frames=all&outline=n_heroimg001&zoom=0.4&x=20&y=20");
  await expectOutlineOn(page, page.locator(`.bp-base ${IMAGE}`));
});
