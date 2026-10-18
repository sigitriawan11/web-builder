import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator, selectedIds } from "./doc-helpers";

// T0.5.6 / ED-060, ED-014, ED-038: visual seleksi, handle, label, hover.

const IMAGE = "n_heroimg001";
const HERO = "n_hero000001";

type Spike = {
  selection: { getState(): { select(ids: string[]): void } };
  interaction: { getState(): { state: { type: string } } };
};

async function select(page: Page, ids: string[]) {
  await page.evaluate(
    (selection) => (window as unknown as { __spike: Spike }).__spike.selection.getState().select(selection),
    ids,
  );
}

for (const zoom of [0.5, 1, 4]) {
  test(`zoom ${zoom * 100}%: 8 handle berukuran tetap di sudut/sisi node, garis 1px (AC ED-060)`, async ({ page }) => {
    await page.goto(`?fixture=hero&zoom=${zoom}&x=20&y=${zoom === 4 ? -900 : 20}`);
    await page.waitForFunction(() => "__spike" in window);
    await select(page, [IMAGE]);
    const handles = page.locator(".overlay-handle");
    await expect(handles).toHaveCount(8);

    for (const handle of await handles.all()) {
      const box = await boxOf(handle);
      expect([box.width, box.height]).toEqual([10, 10]);
      expect(await handle.evaluate((el) => getComputedStyle(el, "::after").width)).toBe("6px");
    }
    const image = await boxOf(nodeLocator(page, IMAGE));
    const nw = await boxOf(page.locator('.overlay-handle[data-handle="nw"]'));
    expect(Math.abs(nw.x + 5 - image.x)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(nw.y + 5 - image.y)).toBeLessThanOrEqual(0.5);
    await expect(page.locator(".overlay-selection-outline")).toHaveCSS("border-top-width", "1px");
  });
}

test("label ukuran: Hug/Fill untuk anak auto-layout, nama frame top-level di atas", async ({ page }) => {
  await page.goto("?fixture=hero&zoom=0.5&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);

  await select(page, [IMAGE]);
  await expect(page.locator(".overlay-size-label")).toHaveText("Fill × 420");
  await expect(page.locator(".overlay-name-label")).toHaveCount(0);

  await select(page, [HERO]);
  await expect(page.locator(".overlay-size-label")).toHaveText("Fill × Hug");
  await expect(page.locator(".overlay-name-label")).toHaveText("Hero");
});

test("node lebih kecil dari 24px screen hanya menampilkan 4 handle sudut", async ({ page }) => {
  await page.goto("?fixture=hero&zoom=0.05&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  await select(page, [IMAGE]);
  await expect(page.locator(".overlay-handle")).toHaveCount(4);
});

test("hover menunjuk node yang akan terpilih bila diklik (ED-038)", async ({ page }) => {
  await page.goto("?fixture=hero&zoom=0.5&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  const title = await boxOf(nodeLocator(page, "n_herottl001"));
  const hoverOutline = page.locator(".overlay-hover-outline");

  await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2);
  await expect(hoverOutline).toHaveCount(1);
  const [outline, hero] = await Promise.all([boxOf(hoverOutline), boxOf(nodeLocator(page, HERO))]);
  expect(Math.abs(outline.height - hero.height)).toBeLessThanOrEqual(0.5);

  // Node yang sudah terseleksi tidak di-hover; keluar dari viewport menghapus hover.
  await page.mouse.click(title.x + title.width / 2, title.y + title.height / 2);
  expect(await selectedIds(page)).toEqual([HERO]);
  await expect(hoverOutline).toHaveCount(0);
  await page.mouse.move(1, 1);
  await page.mouse.move(-5, -5);
  await expect(hoverOutline).toHaveCount(0);
});

test("handle & label disembunyikan saat edit teks", async ({ page }) => {
  // Zoom 100%: tinggi judul ≥ 24px screen sehingga 8 handle tampil (di 50% hanya sudut, sesuai ED-060).
  await page.goto("?fixture=hero&zoom=1&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  const title = nodeLocator(page, "n_herottl001");
  await title.dblclick();
  await expect(page.locator(".overlay-handle")).toHaveCount(8);

  await title.dblclick();
  await expect(title.locator(".ProseMirror")).toBeFocused();
  await expect(page.locator(".overlay-handle")).toHaveCount(0);
  await expect(page.locator(".overlay-size-label")).toHaveCount(0);
});

test("menekan handle memulai dragResize tanpa mengubah seleksi", async ({ page }) => {
  await page.goto("?fixture=hero&zoom=0.5&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  await select(page, [IMAGE]);
  const se = await boxOf(page.locator('.overlay-handle[data-handle="se"]'));

  await page.mouse.move(se.x + 5, se.y + 5);
  await page.mouse.down();
  await page.mouse.move(se.x + 40, se.y + 30, { steps: 4 });
  expect(
    await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.interaction.getState().state.type),
  ).toBe("dragResize");
  await page.mouse.up();

  expect(await selectedIds(page)).toEqual([IMAGE]);
});

test("screenshot overlay seleksi", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Baseline visual hanya Chromium (render font berbeda antar browser).");
  await page.goto("?fixture=hero&zoom=0.5&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  await select(page, [IMAGE]);
  await expect(page.locator(".overlay-handle")).toHaveCount(8);
  const image = await boxOf(nodeLocator(page, IMAGE));

  await expect(page).toHaveScreenshot("selection-overlay.png", {
    clip: { x: image.x - 30, y: image.y - 30, width: image.width + 60, height: image.height + 70 },
  });
});
