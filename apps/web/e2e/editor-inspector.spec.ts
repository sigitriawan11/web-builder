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

test("AC ED-070: edit W dengan ekspresi (100*2 → 200 Fixed) & X node absolute", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Inspector Size")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  const frame = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "frame",
        style: {
          base: {
            position: { type: "absolute", x: 100, y: 120 },
            size: {
              width: { mode: "fixed", value: 120, unit: "px" },
              height: { mode: "fixed", value: 80, unit: "px" },
            },
          },
        },
      })
    ).value,
  );
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);

  const inspector = page.getByTestId("inspector");
  const sizeWidth = inspector.getByTestId("inspector-width");
  await expect(sizeWidth).toHaveValue("120");
  await sizeWidth.fill("100*2");
  await sizeWidth.press("Enter");
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const doc = window.__editorTestApi?.getDoc() as {
          nodes: Record<string, { style: { base: { size?: { width?: { mode: string; value?: number } } } } }>;
        };
        return doc?.nodes[id]?.style.base.size?.width;
      }, frame),
    )
    .toMatchObject({ mode: "fixed", value: 200 });

  const posX = inspector.getByTestId("inspector-x");
  await expect(posX).toHaveValue("100");
  await posX.fill("60");
  await posX.press("Enter");
  await expect
    .poll(() =>
      page.evaluate((id) => {
        const doc = window.__editorTestApi?.getDoc() as {
          nodes: Record<string, { style: { base: { position?: { x?: number } } } }>;
        };
        return doc?.nodes[id]?.style.base.position?.x;
      }, frame),
    )
    .toBe(60);
});

test("T2.8.6 ED-084: mode sizing per sumbu (Fixed/Hug/Fill)", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Sizing Mode")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  const flex = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "frame",
        style: {
          base: {
            layout: { mode: "flex", direction: "row" },
            position: { type: "absolute", x: 0, y: 0 },
            size: {
              width: { mode: "fixed", value: 300, unit: "px" },
              height: { mode: "fixed", value: 120, unit: "px" },
            },
          },
        },
      })
    ).value,
  );
  const child = String(
    (
      await editorCommand(page, "createNode", {
        parentId: flex,
        type: "frame",
        style: {
          base: {
            size: { width: { mode: "fixed", value: 80, unit: "px" }, height: { mode: "fixed", value: 60, unit: "px" } },
          },
        },
      })
    ).value,
  );
  await page.evaluate((id) => window.__editorTestApi?.select([id]), child);

  const widthMode = () =>
    page.evaluate((id) => {
      const d = window.__editorTestApi?.getDoc() as {
        nodes: Record<string, { style: { base: { size?: { width?: { mode?: string } } } } }>;
      };
      return d?.nodes[id]?.style.base.size?.width?.mode;
    }, child);

  const select = page.getByTestId("inspector").getByTestId("inspector-width-mode");
  await expect(select).toHaveValue("fixed");
  await select.selectOption("fill");
  await expect.poll(widthMode).toBe("fill");
  await select.selectOption("hug");
  await expect.poll(widthMode).toBe("hug");
  await select.selectOption("fixed");
  await expect.poll(widthMode).toBe("fixed");
});

test("T2.8.7 ED-085: min/max width & height", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Min Max")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  const pageId = await firstPageId(page);
  const frame = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "frame",
        style: {
          base: {
            position: { type: "absolute", x: 0, y: 0 },
            size: {
              width: { mode: "fixed", value: 120, unit: "px" },
              height: { mode: "fixed", value: 80, unit: "px" },
            },
          },
        },
      })
    ).value,
  );
  await page.evaluate((id) => window.__editorTestApi?.select([id]), frame);
  const inspector = page.getByTestId("inspector");
  const sizeOf = () =>
    page.evaluate((id) => {
      const d = window.__editorTestApi?.getDoc() as {
        nodes: Record<string, { style: { base: { size?: Record<string, { value?: number }> } } }>;
      };
      return d?.nodes[id]?.style.base.size;
    }, frame);

  await inspector.getByTestId("inspector-minWidth").fill("50");
  await inspector.getByTestId("inspector-minWidth").press("Enter");
  await inspector.getByTestId("inspector-maxHeight").fill("200");
  await inspector.getByTestId("inspector-maxHeight").press("Enter");
  await expect.poll(async () => (await sizeOf())?.minWidth?.value).toBe(50);
  expect((await sizeOf())?.maxHeight?.value).toBe(200);
});

test("T2.8.10 ED-088: toggle absolute position untuk anak auto-layout", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Absolute Child")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));

  const pageId = await firstPageId(page);
  const flex = String(
    (
      await editorCommand(page, "createNode", {
        parentId: pageId,
        type: "frame",
        style: {
          base: {
            layout: {
              mode: "flex",
              direction: "row",
              padding: { top: { value: 10, unit: "px" }, left: { value: 10, unit: "px" } },
            },
            position: { type: "absolute", x: 0, y: 0 },
            size: {
              width: { mode: "fixed", value: 300, unit: "px" },
              height: { mode: "fixed", value: 120, unit: "px" },
            },
          },
        },
      })
    ).value,
  );
  const child = String(
    (
      await editorCommand(page, "createNode", {
        parentId: flex,
        type: "frame",
        style: {
          base: {
            size: { width: { mode: "fixed", value: 60, unit: "px" }, height: { mode: "fixed", value: 60, unit: "px" } },
          },
        },
      })
    ).value,
  );
  await page.evaluate((id) => window.__editorTestApi?.select([id]), child);
  await expect.poll(() => page.evaluate((id) => window.__editorTestApi?.getGeometry(id) ?? null, child)).not.toBeNull();

  const posType = () =>
    page.evaluate((id) => {
      const d = window.__editorTestApi?.getDoc() as {
        nodes: Record<string, { style: { base: { position?: { type?: string } } } }>;
      };
      return d?.nodes[id]?.style.base.position?.type;
    }, child);

  await page.getByTestId("inspector").getByTestId("inspector-absolute").click();
  await expect.poll(posType).toBe("absolute");
  await page.getByTestId("inspector").getByTestId("inspector-absolute").click();
  await expect.poll(posType).toBe("flow");
});
