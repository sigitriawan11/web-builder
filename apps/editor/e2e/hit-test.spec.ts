import { expect, type Locator, type Page, test } from "@playwright/test";

// T0.5.2 / ED-020: hit-test di browser sungguhan (elementsFromPoint) dengan aturan locked/hidden/clip.

type Hit = { nodeId: string; path: string[] } | null;
type YMapLike = { get(key: string): YMapLike; set(key: string, value: unknown): void };
type Spike = {
  hit: (x: number, y: number) => Hit;
  run: (op: unknown, input: unknown) => { ok: boolean };
  ops: Record<string, unknown>;
  doc: { getMap(name: string): YMapLike; transact(fn: () => void): void };
};

const ZOOM = 0.5;
const CAMERA = { x: 20, y: 20 };
const node = (page: Page, id: string) => page.locator(`[data-node-id="${id}"]`);

async function hitAt(page: Page, point: { x: number; y: number }): Promise<Hit> {
  return page.evaluate(({ x, y }) => (window as unknown as { __spike: Spike }).__spike.hit(x, y), point);
}

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("elemen tidak terlihat");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

// Kode test: op setLocked/setVisible belum ada, jadi field node diubah langsung di Y.Doc.
async function setNodeField(page: Page, id: string, field: "locked" | "visible", value: boolean) {
  await page.evaluate(
    ({ id, field, value }) => {
      const { doc } = (window as unknown as { __spike: Spike }).__spike;
      doc.transact(() => doc.getMap("nodes").get(id).set(field, value));
    },
    { id, field, value },
  );
}

for (const isolation of ["shadow", "prefix"]) {
  test.describe(`isolation=${isolation}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`?fixture=hero&isolation=${isolation}&zoom=${ZOOM}&x=${CAMERA.x}&y=${CAMERA.y}`);
      await expect(node(page, "n_heroimg001")).toBeVisible();
    });

    test("node bertumpuk: anak di atas parent, area padding milik parent", async ({ page }) => {
      expect(await hitAt(page, await centerOf(node(page, "n_herottl001")))).toEqual({
        nodeId: "n_herottl001",
        path: ["n_herottl001", "n_hero000001", "pg_home000001"],
      });

      const hero = await node(page, "n_hero000001").boundingBox();
      if (!hero) throw new Error("hero tidak terlihat");
      expect((await hitAt(page, { x: hero.x + 4, y: hero.y + 4 }))?.nodeId).toBe("n_hero000001");
    });

    test("node terkunci: klik tembus ke parent; ancestor terkunci ikut mengunci turunan", async ({ page }) => {
      const imageCenter = await centerOf(node(page, "n_heroimg001"));
      const titleCenter = await centerOf(node(page, "n_herottl001"));

      await setNodeField(page, "n_heroimg001", "locked", true);
      expect((await hitAt(page, imageCenter))?.nodeId).toBe("n_hero000001");

      await setNodeField(page, "n_hero000001", "locked", true);
      expect((await hitAt(page, titleCenter))?.nodeId).toBe("pg_home000001");
    });

    test("node tersembunyi tidak bisa dikenai", async ({ page }) => {
      const imageCenter = await centerOf(node(page, "n_heroimg001"));

      await setNodeField(page, "n_heroimg001", "visible", false);
      await expect(node(page, "n_heroimg001")).toBeHidden();

      expect((await hitAt(page, imageCenter))?.nodeId).toBe("n_hero000001");
    });

    test("anak yang terpotong clip parent tidak bisa dikenai di luar area parent (AC ED-020)", async ({ page }) => {
      // Gambar digeser absolute ke tepi kanan hero (1440px world) sehingga meluber ke kanan. Bukan dengan lebar
      // > hero: reset renderer `img{max-width:100%}` (sama dengan publish) membatasi lebar gambar ke parent.
      await page.evaluate(() => {
        const spike = (window as unknown as { __spike: Spike }).__spike;
        spike.run(spike.ops.updateStyle, {
          ids: ["n_heroimg001"],
          patch: {
            position: { type: "absolute", x: 1200, y: 0 },
            size: { width: { mode: "fixed", value: 600, unit: "px" } },
          },
        });
      });
      const image = await node(page, "n_heroimg001").boundingBox();
      if (!image) throw new Error("gambar tidak terlihat");
      // x world 1500 (60px di kanan tepi hero/page), y tengah gambar.
      const overflowPoint = { x: 1500 * ZOOM + CAMERA.x, y: image.y + image.height / 2 };
      expect((await hitAt(page, overflowPoint))?.nodeId).toBe("n_heroimg001");

      await page.evaluate(() => {
        const { doc } = (window as unknown as { __spike: Spike }).__spike;
        doc.transact(() => doc.getMap("nodes").get("n_hero000001").get("props").set("clipContent", true));
      });
      await expect(node(page, "n_hero000001")).toHaveCSS("overflow", "hidden");

      expect(await hitAt(page, overflowPoint)).toBeNull();
    });
  });
}
