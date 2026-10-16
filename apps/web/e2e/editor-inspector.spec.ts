import { expect, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.1.3 / ED-008: kerangka inspector.
test.use({ locale: "en-US", storageState: OWNER_STATE });

test("tanpa seleksi = properti page; seleksi = layer; multi berbeda = Mixed; tab Settings; section tersimpan", async ({
  page,
}) => {
  await page.goto(`${APP_URL}/sites`);
  const editorUrl = `${APP_URL}/editor/${await createSiteViaApi(page, "Inspector Test")}`;
  await page.goto(editorUrl);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  const inspector = page.getByTestId("inspector");
  await expect(inspector.getByTestId("inspector-section-page")).toContainText("Home");

  const pageId = await firstPageId(page);
  const frameA = String(
    (await editorCommand(page, "createNode", { parentId: pageId, type: "frame", name: "Hero" })).value,
  );
  const frameB = String(
    (await editorCommand(page, "createNode", { parentId: pageId, type: "frame", name: "Fitur" })).value,
  );
  const text = String((await editorCommand(page, "createNode", { parentId: frameA, type: "text" })).value);

  const select = (ids: string[]) => page.evaluate((list) => window.__editorTestApi?.select(list), ids);
  await select([frameA]);
  const layer = inspector.getByTestId("inspector-section-layer");
  await expect(layer).toContainText("Frame");
  await expect(layer).toContainText("Hero");

  // Dua frame: tipe sama, nama berbeda → nama Mixed.
  await select([frameA, frameB]);
  await expect(layer).toContainText("2 layers");
  await expect(layer.locator("[data-mixed]")).toHaveCount(1);
  // Frame + teks: tipe juga Mixed.
  await select([frameA, text]);
  await expect(layer.locator("[data-mixed]")).toHaveCount(2);

  await inspector.getByTestId("inspector-tab-settings").click();
  await expect(inspector.getByTestId("inspector-section-html")).toContainText("Mixed");
  await select([frameA]);
  await expect(inspector.getByTestId("inspector-section-html")).toContainText("div");

  // Section diciutkan & lebar tersimpan setelah reload.
  await inspector.getByTestId("inspector-section-html").getByRole("button").click();
  await expect(inspector.getByTestId("inspector-section-html").getByRole("button")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByTestId("inspector-resize").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(inspector).toHaveCSS("width", "296px");
  await page.reload();
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await expect(page.getByTestId("inspector-tab-settings")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("inspector")).toHaveCSS("width", "296px");
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frameA);
  await expect(page.getByTestId("inspector-section-html").getByRole("button")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});
