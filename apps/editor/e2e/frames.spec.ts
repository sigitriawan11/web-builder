import { expect, type Locator, type Page, test } from "@playwright/test";

// T0.4.6 / ED-034: breakpoint frame berdampingan, opsi (a) class dan (b) iframe.

type Spike = {
  run: (op: unknown, input: unknown) => { ok: boolean };
  ops: Record<string, unknown>;
  hitTest: (x: number, y: number) => string | null;
};

function nodeIn(page: Page, mode: string, breakpoint: string, id: string): Locator {
  const selector = `[data-node-id="${id}"]`;
  return mode === "iframe"
    ? page.frameLocator(`iframe.bp-${breakpoint}`).locator(selector)
    : page.locator(`.bp-${breakpoint} ${selector}`);
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("elemen tidak terlihat");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const runOp = (page: Page, op: string, input: unknown) =>
  page.evaluate(
    ([name, payload]) => {
      const spike = (window as unknown as { __spike: Spike }).__spike;
      return spike.run(spike.ops[name as string], payload);
    },
    [op, input] as const,
  );

for (const mode of ["class", "iframe"]) {
  test.describe(`bpMode=${mode}`, () => {
    test("tiga frame dengan style per breakpoint (DM-036)", async ({ page }) => {
      await page.goto(`?fixture=hero&frames=all&bpMode=${mode}`);

      await expect(page.locator(".bp-frame")).toHaveCount(3);
      await expect(nodeIn(page, mode, "base", "n_hero000001")).toHaveCSS("padding-top", "64px");
      await expect(nodeIn(page, mode, "tablet", "n_hero000001")).toHaveCSS("padding-top", "64px");
      await expect(nodeIn(page, mode, "mobile", "n_hero000001")).toHaveCSS("padding-top", "40px");
      await expect(nodeIn(page, mode, "mobile", "n_hero000001")).toHaveCSS("min-height", "420px");
      await expect(nodeIn(page, mode, "mobile", "pg_home000001")).toHaveCSS("width", "390px");
    });

    test("edit konten tampil di semua frame; patch mobile tidak mengubah Desktop (AC ED-034)", async ({ page }) => {
      await page.goto(`?fixture=hero&frames=all&bpMode=${mode}`);

      await runOp(page, "updateStyle", { ids: ["n_hero000001"], patch: { fills: [{ type: "solid", color: "#FF0000" }] } });
      for (const bp of ["base", "tablet", "mobile"]) {
        await expect(nodeIn(page, mode, bp, "n_hero000001")).toHaveCSS("background-color", "rgb(255, 0, 0)");
      }

      await runOp(page, "updateStyle", {
        ids: ["n_hero000001"],
        breakpoint: "mobile",
        patch: { fills: [{ type: "solid", color: "#0000FF" }] },
      });
      await expect(nodeIn(page, mode, "mobile", "n_hero000001")).toHaveCSS("background-color", "rgb(0, 0, 255)");
      await expect(nodeIn(page, mode, "base", "n_hero000001")).toHaveCSS("background-color", "rgb(255, 0, 0)");
    });

    // Kamera dipilih agar frame Tablet terlihat: elementsFromPoint tidak menjangkau titik di luar layar.
    for (const { zoom, x } of [
      { zoom: 0.5, x: 20 },
      { zoom: 1, x: -1400 },
    ]) {
      test(`hit-test titik screen → node yang tepat di zoom ${zoom * 100}%`, async ({ page }) => {
        await page.goto(`?fixture=hero&frames=all&bpMode=${mode}&zoom=${zoom}&x=${x}&y=20`);
        const hitTest = (point: { x: number; y: number }) =>
          page.evaluate(({ x, y }) => (window as unknown as { __spike: Spike }).__spike.hitTest(x, y), point);

        const tabletImage = nodeIn(page, mode, "tablet", "n_heroimg001");
        await expect(tabletImage).toBeVisible();
        expect(await hitTest(await center(tabletImage))).toBe("n_heroimg001");
        expect(await hitTest(await center(nodeIn(page, mode, "tablet", "n_herottl001")))).toBe("n_herottl001");

        // Celah 100px world antara frame Tablet dan Mobile tidak berisi node.
        const tablet = await nodeIn(page, mode, "tablet", "pg_home000001").boundingBox();
        if (!tablet) throw new Error("frame Tablet tidak terlihat");
        expect(await hitTest({ x: tablet.x + tablet.width + 50 * zoom, y: tablet.y + 20 })).toBeNull();
      });
    }
  });
}
