import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { createSiteViaApi } from "./support/sites";

// T2.12.3 / ED-160: drag-drop gambar ke canvas lewat stack sungguhan (editor → api presign → PUT MinIO → complete →
// worker image-processing). Membuktikan node image dibuat & asset diproses sampai `ready`.
test.use({ locale: "en-US", storageState: OWNER_STATE });

// PNG 1×1 valid (base64; bisa diproses sharp di worker). File dibangun dari base64 langsung (CSP memblok fetch data:).
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

type ImageNode = {
  type: string;
  props?: { image?: { assetId?: string; focalPoint?: { x: number; y: number } }; fit?: string; loading?: string };
  style?: { base?: { size?: unknown } };
};
type DocShape = { nodes: Record<string, ImageNode> };
const getDoc = (page: Page) => page.evaluate(() => window.__editorTestApi?.getDoc() as DocShape);

// Simulasikan drop satu file gambar ke tengah viewport canvas (CSP memblok fetch data: → bangun File dari base64).
async function dropImage(page: Page, fileName: string): Promise<void> {
  await page.evaluate(
    ({ b64, name }) => {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], name, { type: "image/png" });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const viewport = document.getElementById("editor-viewport");
      if (!viewport) throw new Error("viewport tidak ada");
      const rect = viewport.getBoundingClientRect();
      const init = {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        dataTransfer,
      };
      viewport.dispatchEvent(new DragEvent("dragover", init));
      viewport.dispatchEvent(new DragEvent("drop", init));
    },
    { b64: PNG_BASE64, name: fileName },
  );
}

async function assetStatus(page: Page, siteId: string, assetId: string): Promise<string> {
  return page.evaluate(
    async ([sid, aid]) => {
      const res = await fetch(`/api/v1/sites/${sid}/assets/${aid}`);
      return res.ok ? ((await res.json()).data?.status as string) : `http-${res.status}`;
    },
    [siteId, assetId],
  );
}

test("AC ED-160: drop file gambar → node image dibuat & asset diproses ready", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  const siteId = await createSiteViaApi(page, "Asset Upload Test");
  await page.goto(`${APP_URL}/editor/${siteId}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  // Simulasikan drop file ke viewport canvas.
  await dropImage(page, "logo.png");

  // Node image muncul di dokumen (optimistik setelah upload selesai).
  let assetId = "";
  await expect
    .poll(
      async () => {
        const doc = await getDoc(page);
        const image = Object.values(doc.nodes).find((node) => node.type === "image");
        assetId = image?.props?.image?.assetId ?? "";
        return assetId;
      },
      { timeout: 15_000 },
    )
    .toMatch(/^ast_/);

  // Asset terdaftar di dokumen & diproses worker sampai `ready` (varian/dimensi).
  await expect.poll(() => assetStatus(page, siteId, assetId), { timeout: 20_000 }).toBe("ready");

  // ED-161: pustaka media — buka tab Assets, aset `ready` muncul sebagai tile dengan thumbnail dari endpoint content.
  await page.getByTestId("left-tab-assets").click();
  const tile = page.locator(`[data-testid="asset-tile"][data-asset-id="${assetId}"]`);
  await expect(tile).toBeVisible();
  await expect(tile).toHaveAttribute("data-status", "ready");
  // Thumbnail mengikuti redirect content → URL presigned (bukan gambar rusak).
  await expect
    .poll(() => tile.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 10_000 })
    .toBeGreaterThan(0);

  // Hapus aset dari pustaka (konfirmasi) → tile hilang.
  page.once("dialog", (dialog) => dialog.accept());
  await tile.getByTestId("asset-delete").click();
  await expect(tile).toHaveCount(0);
});

test("AC ED-165: inspector Image — ubah fit, titik fokus, dan ganti gambar (pertahankan ukuran & fit)", async ({
  page,
}) => {
  await page.goto(`${APP_URL}/sites`);
  const siteId = await createSiteViaApi(page, "Image Inspector Test");
  await page.goto(`${APP_URL}/editor/${siteId}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  // Dua gambar: node pertama akan diganti dengan asset kedua lewat inspector.
  await dropImage(page, "first.png");
  const firstId = await waitForImageNode(page, new Set());
  await dropImage(page, "second.png");
  const secondId = await waitForImageNode(page, new Set([firstId]));

  const assetOf = async (id: string) => (await getDoc(page)).nodes[id]?.props?.image?.assetId ?? "";
  const firstAsset = await assetOf(firstId);
  const secondAsset = await assetOf(secondId);
  await expect.poll(() => assetStatus(page, siteId, secondAsset), { timeout: 20_000 }).toBe("ready");

  // Pilih node pertama → inspector Image muncul.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), firstId);
  await expect(page.getByTestId("image-fit")).toBeVisible();

  // Ubah fit → tersimpan di dokumen.
  await page.getByTestId("image-fit").selectOption("contain");
  await expect.poll(async () => (await getDoc(page)).nodes[firstId]?.props?.fit).toBe("contain");

  // Titik fokus → tersimpan.
  await page.getByTestId("image-focal-x").fill("0.25");
  await page.getByTestId("image-focal-x").blur();
  await expect.poll(async () => (await getDoc(page)).nodes[firstId]?.props?.image?.focalPoint?.x).toBe(0.25);

  const sizeBefore = JSON.stringify((await getDoc(page)).nodes[firstId]?.style?.base?.size);

  // Ganti gambar dari pustaka dengan asset kedua → assetId berubah, fit & ukuran dipertahankan (AC).
  await page.getByTestId("image-replace").click();
  await page.getByTestId(`image-replace-asset-${secondAsset}`).click();
  await expect.poll(() => assetOf(firstId)).toBe(secondAsset);
  expect(await assetOf(firstId)).not.toBe(firstAsset);
  expect((await getDoc(page)).nodes[firstId]?.props?.fit).toBe("contain"); // fit dipertahankan
  expect(JSON.stringify((await getDoc(page)).nodes[firstId]?.style?.base?.size)).toBe(sizeBefore); // ukuran sama
});

test("AC ED-224: 100 gambar di satu page tidak memuat >20 sebelum scroll/pan (lazy)", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Lazy Images Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  // Hitung tiap permintaan ke endpoint content (fake asset → 404, tapi permintaan tetap tercatat = indikasi dimuat).
  const requested = new Set<string>();
  page.on("request", (req) => {
    const match = req.url().match(/\/assets\/[^/]+\/content/);
    if (match) requested.add(req.url());
  });

  // Zoom 100% lebih dulu agar hanya bagian atas page terlihat (fokus kanvas → shortcut aktif).
  await page.getByTestId("editor-viewport").click({ position: { x: 10, y: 10 } });
  await page.keyboard.press("Shift+0");

  // Seed 100 node image absolute, berjarak jauh secara vertikal (jauh melebihi viewport).
  await page.evaluate(() => {
    const api = window.__editorTestApi;
    if (!api) throw new Error("test API tidak ada");
    const doc = api.getDoc() as { nodes: Record<string, { type: string }> };
    const pageId = Object.entries(doc.nodes).find(([, node]) => node.type === "page")?.[0];
    if (!pageId) throw new Error("page tidak ada");
    for (let i = 0; i < 100; i++) {
      const id = `ast_lazy${String(i).padStart(7, "0")}`;
      api.runCommand("registerAsset", { id, entry: { kind: "image", mime: "image/png" } });
      api.runCommand("createNode", {
        parentId: pageId,
        type: "image",
        props: { image: { assetId: id }, fit: "cover" },
        style: {
          base: {
            size: {
              width: { mode: "fixed", value: 200, unit: "px" },
              height: { mode: "fixed", value: 200, unit: "px" },
            },
            position: { type: "absolute", x: 0, y: i * 1000 },
          },
        },
      });
    }
  });

  // Beri waktu lazy-load observer menyelesaikan permintaan untuk gambar yang terlihat.
  await expect.poll(async () => (await getDoc(page)).nodes, { timeout: 5_000 }).toBeTruthy();
  await page.waitForTimeout(1500);
  expect(requested.size).toBeLessThanOrEqual(20);
  expect(requested.size).toBeGreaterThan(0); // sanity: mekanisme memang menembak permintaan untuk yang terlihat
});

// Tunggu node image baru (yang belum ada di `known`) muncul & punya assetId.
async function waitForImageNode(page: Page, known: Set<string>): Promise<string> {
  let id = "";
  await expect
    .poll(
      async () => {
        const doc = await getDoc(page);
        const entry = Object.entries(doc.nodes).find(
          ([nid, node]) => node.type === "image" && node.props?.image?.assetId && !known.has(nid),
        );
        id = entry?.[0] ?? "";
        return id;
      },
      { timeout: 15_000 },
    )
    .not.toBe("");
  return id;
}
