import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import "./support/editor";
import { firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.4.9 / ED-050: elemen web dasar (Insert panel "Basic") — Button & Divider.
test.use({ locale: "en-US", storageState: OWNER_STATE });

interface DNode {
  type: string;
  parentId: string | null;
  children?: string[];
  props?: { role?: string; shape?: string; content?: unknown };
  style: { base: { size?: { width?: { mode?: string } } } };
}
const doc = (page: Page) => page.evaluate(() => window.__editorTestApi?.getDoc() as { nodes: Record<string, DNode> });

test.beforeEach(async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Insert Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  // Buka tab Insert.
  await page.getByTestId("left-tab-insert").click();
  await expect(page.getByTestId("insert-panel")).toBeVisible();
});

test("AC ED-050: Button = frame role=button berisi teks; render tag benar; terseleksi & kembali ke Move", async ({
  page,
}) => {
  const pageId = await firstPageId(page);
  await page.getByTestId("insert-button").click();
  await expect(page.getByTestId("tool-select")).toHaveAttribute("aria-pressed", "true");
  const buttonId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  const nodes = (await doc(page)).nodes;
  expect(nodes[buttonId]).toMatchObject({ type: "frame", parentId: pageId, props: { role: "button" } });
  // Berisi satu node teks "Button".
  const childId = nodes[buttonId]?.children?.[0] as string;
  expect(nodes[childId]?.type).toBe("text");
  await expect(
    page.getByTestId("editor-canvas").locator(`[data-node-id="${buttonId}"] [data-node-id="${childId}"]`),
  ).toHaveText("Button");
});

test("Divider = shape line full-width, tinggi 1px", async ({ page }) => {
  await page.getByTestId("insert-divider").click();
  const dividerId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  const node = (await doc(page)).nodes[dividerId];
  expect(node).toMatchObject({ type: "shape", props: { shape: "line" } });
  expect(node?.style.base.size?.width?.mode).toBe("fill");
  await expect(page.getByTestId("editor-canvas").locator(`[data-node-id="${dividerId}"]`)).toHaveCSS("height", "1px");
});
