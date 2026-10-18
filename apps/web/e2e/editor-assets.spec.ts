import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { createSiteViaApi } from "./support/sites";

// T2.12.3 / ED-160: drag-drop gambar ke canvas lewat stack sungguhan (editor → api presign → PUT MinIO → complete →
// worker image-processing). Membuktikan node image dibuat & asset diproses sampai `ready`.
test.use({ locale: "en-US", storageState: OWNER_STATE });

// PNG 1×1 valid (base64; bisa diproses sharp di worker). File dibangun dari base64 langsung (CSP memblok fetch data:).
const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC";

type DocShape = { nodes: Record<string, { type: string; props?: { image?: { assetId?: string } } }> };
const getDoc = (page: Page) => page.evaluate(() => window.__editorTestApi?.getDoc() as DocShape);

test("AC ED-160: drop file gambar → node image dibuat & asset diproses ready", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  const siteId = await createSiteViaApi(page, "Asset Upload Test");
  await page.goto(`${APP_URL}/editor/${siteId}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  // Simulasikan drop file ke viewport canvas.
  await page.evaluate((b64) => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const file = new File([bytes], "logo.png", { type: "image/png" });
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
  }, PNG_BASE64);

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
  const status = async () =>
    page.evaluate(
      async ([sid, aid]) => {
        const res = await fetch(`/api/v1/sites/${sid}/assets/${aid}`);
        return res.ok ? ((await res.json()).data?.status as string) : `http-${res.status}`;
      },
      [siteId, assetId],
    );
  await expect.poll(status, { timeout: 20_000 }).toBe("ready");

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
