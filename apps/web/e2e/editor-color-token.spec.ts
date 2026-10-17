import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.11.10 / ED-129: pilih token warna di input → ref `{$token}` tersimpan (bukan literal hex).
test.use({ locale: "en-US", storageState: OWNER_STATE });

const fillColor = (page: Page, id: string) =>
  page.evaluate((nid) => {
    const docu = window.__editorTestApi?.getDoc() as
      | { nodes: Record<string, { style?: { base?: { fills?: { color?: unknown }[] } } }> }
      | undefined;
    return docu?.nodes[nid]?.style?.base?.fills?.[0]?.color ?? null;
  }, id);

test("AC ED-129: pilih token color.primary di fill → ref $token tersimpan", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Color Token Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  const pageId = await firstPageId(page);
  const frame = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "frame",
        style: {
          base: {
            position: { type: "absolute", x: 40, y: 40 },
            size: {
              width: { mode: "fixed", value: 200, unit: "px" },
              height: { mode: "fixed", value: 120, unit: "px" },
            },
            fills: [{ type: "solid", color: "#ff0000" }],
          },
        },
      })
    ).value,
  );
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);

  // Buka picker fill → pilih token color.primary.
  await page.getByTestId("fill-color-0").click();
  await page.getByTestId("fill-color-0-token-color.primary").click();

  await expect.poll(() => fillColor(page, frame)).toEqual({ $token: "color.primary" });
});
