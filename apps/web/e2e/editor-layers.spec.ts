import { expect, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.13.1 / ED-136: tree layers (react-arborist) + sinkron seleksi dua arah dengan canvas.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const sizeFixed = (w: number, h: number) => ({
  width: { mode: "fixed" as const, value: w, unit: "px" as const },
  height: { mode: "fixed" as const, value: h, unit: "px" as const },
});

test("AC ED-136: tree layers tampil & seleksi sinkron dua arah", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Layers Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  const pageId = await firstPageId(page);
  const frame = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "frame",
        style: { base: { position: { type: "absolute", x: 40, y: 40 }, size: sizeFixed(200, 160) } },
      })
    ).value,
  );
  const child = String(
    (
      await editorCommand(page, "createNode", {
        parentId: frame,
        type: "shape",
        props: { shape: "rect" },
        style: { base: { size: sizeFixed(80, 80) } },
      })
    ).value,
  );

  // Tab Layers = default. Tree menampilkan frame & anaknya.
  await expect(page.getByTestId("layers-tree")).toBeVisible();
  await expect(page.getByTestId(`layer-${frame}`)).toBeVisible();
  await expect(page.getByTestId(`layer-${child}`)).toBeVisible();

  // Klik layer → node terseleksi di canvas.
  await page.getByTestId(`layer-${child}`).click();
  await expect.poll(() => page.evaluate(() => window.__editorTestApi?.getSelection() ?? [])).toEqual([child]);

  // Seleksi di canvas (via API) → baris layer ter-highlight (aria-selected).
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);
  await expect(page.getByTestId(`layer-${frame}`)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId(`layer-${child}`)).toHaveAttribute("aria-selected", "false");
});
