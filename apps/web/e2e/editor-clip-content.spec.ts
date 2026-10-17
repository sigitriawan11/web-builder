import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.10.9 / ED-112: checkbox "Clip content" pada frame → props.clipContent → renderer overflow:hidden.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const clipOf = (page: Page, id: string) =>
  page.evaluate((nid) => {
    const doc = window.__editorTestApi?.getDoc() as {
      nodes: Record<string, { props?: { clipContent?: boolean } }>;
    };
    return doc.nodes[nid]?.props?.clipContent;
  }, id);

test("AC ED-112: toggle Clip content pada frame → props.clipContent & overflow:hidden", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Clip Content")}`);
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
          },
        },
      })
    ).value,
  );
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);

  const checkbox = page.getByTestId("clip-content");
  await expect(checkbox).toBeVisible();
  expect(await clipOf(page, frame)).toBeUndefined();

  await checkbox.click();
  await expect.poll(() => clipOf(page, frame)).toBe(true);
  await expect(page.getByTestId("editor-canvas").locator(`[data-node-id="${frame}"]`)).toHaveCSS("overflow", "hidden");

  // Toggle off → prop dihapus, overflow kembali visible.
  await checkbox.click();
  await expect.poll(() => clipOf(page, frame)).toBeUndefined();
  await expect(page.getByTestId("editor-canvas").locator(`[data-node-id="${frame}"]`)).not.toHaveCSS(
    "overflow",
    "hidden",
  );
});
