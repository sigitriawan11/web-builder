import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.4.8 / ED-046: icon tool (picker Lucide).
test.use({ locale: "en-US", storageState: OWNER_STATE });

const doc = (page: Page) =>
  page.evaluate(
    () =>
      window.__editorTestApi?.getDoc() as {
        nodes: Record<
          string,
          {
            type: string;
            props?: { set?: string; name?: string };
            style?: { base?: { position?: { type?: string } } };
          }
        >;
      },
  );

test("AC ED-046: cari 'phone' → sisip node icon Lucide; kembali ke Move; ter-render sebagai SVG", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Icon Tool Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  await page.getByTestId("tool-icon").click();
  await expect(page.getByTestId("icon-picker")).toBeVisible();
  await page.getByTestId("icon-search").fill("phone");
  await expect(page.getByTestId("icon-option-phone")).toBeVisible();
  await page.getByTestId("icon-option-phone").click();

  await expect(page.getByTestId("icon-picker")).toHaveCount(0);
  await expect(page.getByTestId("tool-select")).toHaveAttribute("aria-pressed", "true");
  const iconId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  const node = (await doc(page)).nodes[iconId];
  expect(node).toMatchObject({ type: "icon", props: { set: "lucide", name: "phone" } });
  // ED-037: disisipkan di page freeform → absolute agar bisa digeser (bukan flow child yang hanya bisa resize).
  expect(node?.style?.base?.position?.type).toBe("absolute");
  // Dirender span berisi SVG (DM-015).
  const el = page.getByTestId("editor-canvas").locator(`[data-node-id="${iconId}"]`);
  expect(await el.evaluate((node) => node.tagName)).toBe("SPAN");
  await expect(el.locator("svg")).toBeVisible();

  // Tersimpan setelah reload.
  await page.reload();
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await expect(page.getByTestId("editor-canvas").locator(`[data-node-id="${iconId}"] svg`)).toBeAttached();
});

test("AC ED-163: tab Assets → Icons → cari 'phone' → sisip node icon", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Assets Icons Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  await page.getByTestId("left-tab-assets").click();
  await page.getByTestId("assets-view-icons").click();
  await page.getByTestId("icon-search").fill("phone");
  await page.getByTestId("icon-option-phone").click();

  const iconId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  expect((await doc(page)).nodes[iconId]).toMatchObject({ type: "icon", props: { set: "lucide", name: "phone" } });
});
