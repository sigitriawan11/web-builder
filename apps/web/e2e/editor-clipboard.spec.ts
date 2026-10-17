import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand, firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.14.1/2.14.3 / ED-190/193: copy-paste (id baru, bersarang) & duplicate (Mod+D).
test.use({ locale: "en-US", storageState: OWNER_STATE });
const sizeFixed = (w: number, h: number) => ({
  width: { mode: "fixed" as const, value: w, unit: "px" as const },
  height: { mode: "fixed" as const, value: h, unit: "px" as const },
});
const create = (page: Page, args: Record<string, unknown>) =>
  editorCommand(page, "createNode", args).then((r) => String(r.value));
const doc = (page: Page) =>
  page.evaluate(
    () =>
      window.__editorTestApi?.getDoc() as {
        nodes: Record<string, { type: string; parentId: string | null; children?: string[] }>;
      },
  );

test("AC ED-190/193: copy-paste 3 level → id baru; duplicate Mod+D", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Clipboard Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  const pageId = await firstPageId(page);
  const a = await create(page, {
    parentId: pageId,
    type: "frame",
    style: { base: { position: { type: "absolute", x: 40, y: 40 }, size: sizeFixed(200, 160) } },
  });
  const b = await create(page, { parentId: a, type: "frame", style: { base: { size: sizeFixed(120, 90) } } });
  const c = await create(page, {
    parentId: b,
    type: "shape",
    props: { shape: "rect" },
    style: { base: { size: sizeFixed(40, 40) } },
  });

  await page.evaluate((id) => window.__editorTestApi?.select([id]), a);
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");

  const pageChildren = () => doc(page).then((d) => d.nodes[pageId]?.children ?? []);
  await expect.poll(async () => (await pageChildren()).length).toBe(2);
  const d1 = await doc(page);
  const copyA = (d1.nodes[pageId]?.children ?? []).find((id) => id !== a) as string;
  expect(copyA).toBeTruthy();
  expect(copyA).not.toBe(a);
  // Struktur 3 level tersalin dengan id baru.
  const copyB = d1.nodes[copyA]?.children?.[0] as string;
  const copyC = d1.nodes[copyB]?.children?.[0] as string;
  expect(d1.nodes[copyA]?.type).toBe("frame");
  expect(d1.nodes[copyB]?.type).toBe("frame");
  expect(d1.nodes[copyC]?.type).toBe("shape");
  expect([copyB, copyC]).not.toContain(b);
  expect([copyB, copyC]).not.toContain(c);

  // Duplicate (Mod+D) node asli → bertambah satu lagi di page.
  await page.evaluate((id) => window.__editorTestApi?.select([id]), a);
  await page.keyboard.press("ControlOrMeta+d");
  await expect.poll(async () => (await pageChildren()).length).toBe(3);
});

test("AC ED-191: paste in place (Mod+Shift+V) → posisi sama", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Paste In Place Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  const pageId = await firstPageId(page);
  const a = await create(page, {
    parentId: pageId,
    type: "frame",
    style: { base: { position: { type: "absolute", x: 40, y: 40 }, size: sizeFixed(100, 80) } },
  });
  await page.evaluate((id) => window.__editorTestApi?.select([id]), a);
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+Shift+v");

  await expect.poll(async () => ((await doc(page)).nodes[pageId]?.children ?? []).length).toBe(2);
  const d = await doc(page);
  const copy = (d.nodes[pageId]?.children ?? []).find((id) => id !== a) as string;
  const pos = (d.nodes[copy] as { style?: { base?: { position?: { x?: number; y?: number } } } })?.style?.base
    ?.position;
  expect(pos).toMatchObject({ x: 40, y: 40 });
});
