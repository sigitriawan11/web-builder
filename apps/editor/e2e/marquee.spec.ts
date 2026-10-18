import { expect, type Page, test } from "@playwright/test";
import { boxOf, idsByName, nodeLocator, selectedIds } from "./doc-helpers";

// T0.5.5 / ED-053: marquee selection di fixture landing.

async function drag(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  options: { shift?: boolean; escape?: boolean } = {},
) {
  if (options.shift) await page.keyboard.down("Shift");
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  if (options.escape) await page.keyboard.press("Escape");
  await page.mouse.up();
  if (options.shift) await page.keyboard.up("Shift");
}

test.describe("marquee top-level (dari luar page)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("?fixture=landing200&zoom=0.25&x=20&y=20");
    await page.waitForFunction(() => "__spike" in window);
    await expect(page.locator("[data-node-id]").first()).toBeVisible();
  });

  test("memilih section yang bersinggungan, dengan highlight live selama drag", async ({ page }) => {
    const id = await idsByName(page, ["Hero", "Fitur 1", "Fitur 2"]);
    const hero = await boxOf(nodeLocator(page, id.Hero));
    const feature1 = await boxOf(nodeLocator(page, id["Fitur 1"]));
    // Dari kanan page (area kosong) ke dalam page, vertikal dari tengah Hero sampai tengah Fitur 1.
    const from = { x: hero.x + hero.width + 40, y: hero.y + hero.height / 2 };
    const to = { x: hero.x + hero.width - 40, y: feature1.y + feature1.height / 2 };

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await expect(page.locator(".overlay-marquee")).toBeVisible();
    await expect(page.locator(".overlay-marquee-hit")).toHaveCount(2);
    await page.mouse.up();

    expect(await selectedIds(page)).toEqual([id.Hero, id["Fitur 1"]]);
    await expect(page.locator(".overlay-marquee")).toHaveCount(0);
    // Multi-seleksi: satu kotak gabungan + outline tipis per node.
    await expect(page.locator(".overlay-selection-outline")).toHaveCount(1);
    await expect(page.locator(".overlay-selection-member")).toHaveCount(2);
    expect(await selectedIds(page)).not.toContain(id["Fitur 2"]);
  });

  test("Esc membatalkan marquee tanpa mengubah seleksi", async ({ page }) => {
    const id = await idsByName(page, ["Hero", "Fitur 1"]);
    const hero = await boxOf(nodeLocator(page, id.Hero));
    await nodeLocator(page, id.Hero).click({ position: { x: 4, y: 4 } });

    await drag(
      page,
      { x: hero.x + hero.width + 40, y: hero.y + 10 },
      { x: hero.x + 40, y: hero.y + hero.height + 60 },
      { escape: true },
    );

    expect(await selectedIds(page)).toEqual([id.Hero]);
  });

  test("Shift + marquee menambah ke seleksi; marquee tanpa kena apa pun mengosongkan", async ({ page }) => {
    const id = await idsByName(page, ["Navbar", "Fitur 2"]);
    await nodeLocator(page, id.Navbar).click({ position: { x: 4, y: 4 } });
    const feature2 = await boxOf(nodeLocator(page, id["Fitur 2"]));

    await drag(
      page,
      { x: feature2.x + feature2.width + 40, y: feature2.y + 10 },
      { x: feature2.x + feature2.width - 20, y: feature2.y + 20 },
      { shift: true },
    );
    expect(await selectedIds(page)).toEqual([id.Navbar, id["Fitur 2"]]);

    await drag(page, { x: 1150, y: 300 }, { x: 1200, y: 360 });
    expect(await selectedIds(page)).toEqual([]);
  });
});

test("marquee di dalam frame yang dimasuki memilih anak-anaknya (ED-053)", async ({ page }) => {
  await page.goto("?fixture=landing200&zoom=0.5&x=20&y=20");
  await page.waitForFunction(() => "__spike" in window);
  const id = await idsByName(page, ["Kartu 1", "Kartu 2"]);
  // Canvas memakai transform (bukan scroll): geser kamera agar Kartu 1 berada di atas layar.
  const before = await boxOf(nodeLocator(page, id["Kartu 1"]));
  await page.evaluate((shift) => {
    const camera = (
      window as unknown as { __spike: { camera: { getState(): { y: number; setCamera(next: { y: number }): void } } } }
    ).__spike.camera.getState();
    camera.setCamera({ y: camera.y + shift });
  }, 150 - before.y);
  await expect.poll(async () => Math.round((await boxOf(nodeLocator(page, id["Kartu 1"]))).y)).toBe(150);
  const card1 = await boxOf(nodeLocator(page, id["Kartu 1"]));
  const card2 = await boxOf(nodeLocator(page, id["Kartu 2"]));

  // Masuk sampai kartu terseleksi: section → container → grid → kartu (di tengah kartu, jauh dari handle).
  for (let i = 0; i < 3; i++) await nodeLocator(page, id["Kartu 1"]).dblclick();
  expect(await selectedIds(page)).toEqual([id["Kartu 1"]]);

  // Mulai di celah antara Kartu 1 & 2 (latar grid yang dimasuki). Titik harus di DALAM grid: tepat di atas
  // kartu sudah latar Container, dan drag di sana = pilih Container lalu pindah (ED-038).
  const gapX = (card1.x + card1.width + card2.x) / 2;
  await drag(page, { x: gapX, y: card1.y + 10 }, { x: card1.x + 20, y: card1.y + 40 });
  expect(await selectedIds(page)).toEqual([id["Kartu 1"]]);

  await drag(page, { x: gapX, y: card1.y + 10 }, { x: card2.x + card2.width - 20, y: card1.y + 40 });
  expect(await selectedIds(page)).toEqual([id["Kartu 2"]]);
});
