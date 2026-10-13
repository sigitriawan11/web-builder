import { expect, type Page, test } from "@playwright/test";
import { boxOf, nodeLocator } from "./doc-helpers";

// T0.6.4 / DM-026, DM-027: auto-layout dirender sebagai flexbox nyata. Zoom 100%: 1px screen = 1px world.

type Box = { x: number; y: number; width: number; height: number };
const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.5);

async function boxes<const T extends string>(page: Page, ids: readonly T[]): Promise<Record<T, Box>> {
  const entries = await Promise.all(ids.map(async (id) => [id, await boxOf(nodeLocator(page, id))] as const));
  return Object.fromEntries(entries) as Record<T, Box>;
}

test.beforeEach(async ({ page }) => {
  await page.goto("?fixture=autolayout&zoom=1&x=0&y=0");
  await expect(nodeLocator(page, "n_alrow00001")).toBeVisible();
});

test("baris: padding, gap 16, align center; anak fixed / fill / hug", async ({ page }) => {
  const b = await boxes(page, ["n_alrow00001", "n_alrowfix01", "n_alrowfil01", "n_alrowhug01"]);
  const row = b.n_alrow00001;
  const [fix, fill, hug] = [b.n_alrowfix01, b.n_alrowfil01, b.n_alrowhug01];

  // Fixed: ukuran persis; padding kiri 24.
  near(fix.x, row.x + 24);
  near(fix.width, 120);
  near(fix.height, 80);
  // Gap 16 di antara anak.
  near(fill.x, fix.x + fix.width + 16);
  near(hug.x, fill.x + fill.width + 16);
  // Hug tidak boleh ikut terjepit oleh Fill: teks tetap satu baris & tidak terpotong.
  const hugOverflow = await nodeLocator(page, "n_alrowhug01").evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(hugOverflow).toBeLessThanOrEqual(0);
  expect(hug.height).toBeLessThan(30);
  // Hug: selebar konten; padding kanan 24; Fill mengisi sisa ruang.
  near(hug.x + hug.width, row.x + row.width - 24);
  near(fill.width, row.width - 48 - 120 - hug.width - 32);
  // Hug tinggi = tertinggi anak + padding; align center vertikal.
  near(row.height, 80 + 48);
  for (const child of [fix, fill, hug]) near(child.y + child.height / 2, row.y + row.height / 2);
});

test("kolom: justify spaceBetween & align stretch di tinggi tetap 300", async ({ page }) => {
  const b = await boxes(page, ["n_alcol00001", "n_alcoltxt01", "n_alcolbox01", "n_alcolbox02"]);
  const col = b.n_alcol00001;

  near(col.height, 300);
  near(b.n_alcoltxt01.y, col.y + 16);
  near(b.n_alcolbox02.y + b.n_alcolbox02.height, col.y + col.height - 16);
  // spaceBetween: jarak antar anak sama.
  const gap1 = b.n_alcolbox01.y - (b.n_alcoltxt01.y + b.n_alcoltxt01.height);
  const gap2 = b.n_alcolbox02.y - (b.n_alcolbox01.y + b.n_alcolbox01.height);
  near(gap1, gap2);
  // Stretch / fill: selebar kolom dikurangi padding.
  for (const child of [b.n_alcoltxt01, b.n_alcolbox01, b.n_alcolbox02]) {
    near(child.x, col.x + 16);
    near(child.width, col.width - 32);
  }
});

test("wrap: 3 kotak per baris (gap 12), baris kedua berjarak crossGap 20", async ({ page }) => {
  const ids = ["n_alwrap0001", "n_alwrap0a01", "n_alwrap0a02", "n_alwrap0a03", "n_alwrap0a04", "n_alwrap0a05"] as const;
  const b = await boxes(page, ids);
  const [first, second, third, fourth] = [b.n_alwrap0a01, b.n_alwrap0a02, b.n_alwrap0a03, b.n_alwrap0a04];

  near(second.x, first.x + 100 + 12);
  near(third.y, first.y);
  // Kotak ke-4 pindah ke baris kedua.
  near(fourth.x, first.x);
  near(fourth.y, first.y + 50 + 20);
  // Hug tinggi: 2 baris + crossGap + padding.
  near(b.n_alwrap0001.height, 50 * 2 + 20 + 20);
});

test("screenshot tiga kombinasi auto-layout", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Baseline visual hanya Chromium.");
  await expect(page).toHaveScreenshot("autolayout.png", { clip: { x: 0, y: 0, width: 900, height: 760 } });
});
