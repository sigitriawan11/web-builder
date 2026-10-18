import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { createSiteViaApi } from "./support/sites";

// T2.13.10 / ED-142: kotak cari di panel Layers — cocokkan nama layer ATAU isi teks; hasil disaring (react-arborist).
test.use({ locale: "en-US", storageState: OWNER_STATE });

const run = (page: Page, name: string, args: unknown) =>
  page.evaluate(
    ([n, a]) =>
      (window.__editorTestApi?.runCommand(n as string, a) as { ok: boolean; value?: string }) ?? { ok: false },
    [name, args] as [string, unknown],
  );

test("AC ED-142: cari 'harga' menemukan node teks berisi 'Harga mulai', menyembunyikan lainnya", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Layer Search Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  const pageId = await page.evaluate(() => {
    const doc = window.__editorTestApi?.getDoc() as { nodes: Record<string, { type: string }> };
    return Object.entries(doc.nodes).find(([, n]) => n.type === "page")?.[0] ?? "";
  });

  // Node teks berisi "Harga mulai" + sebuah frame lain.
  const textRes = await run(page, "createNode", {
    parentId: pageId,
    type: "text",
    name: "Label",
    props: {
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Harga mulai 99rb" }] }] },
    },
  });
  const frameRes = await run(page, "createNode", { parentId: pageId, type: "frame", name: "Lainnya" });
  const textId = textRes.value as string;
  const frameId = frameRes.value as string;

  // Pastikan tab Layers aktif.
  await page.getByTestId("left-tab-layers").click();
  await expect(page.getByTestId(`layer-${textId}`)).toBeVisible();
  await expect(page.getByTestId(`layer-${frameId}`)).toBeVisible();

  // Cari "harga" → node teks tetap (cocok via isi teks), frame lain disaring keluar.
  await page.getByTestId("layers-search").fill("harga");
  await expect(page.getByTestId(`layer-${textId}`)).toBeVisible();
  await expect(page.getByTestId(`layer-${frameId}`)).toHaveCount(0);

  // Kosongkan → semua muncul lagi.
  await page.getByTestId("layers-search").fill("");
  await expect(page.getByTestId(`layer-${frameId}`)).toBeVisible();
});
