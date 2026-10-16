import { expect, test } from "@playwright/test";
import { APP_URL, MARKETING_URL } from "../playwright.config";

// T1.14.9: landing marketing placeholder (apex, statis) & 404 global yang berfungsi tanpa JavaScript.

test("landing apex: judul & CTA ke host app (daftar/masuk)", async ({ page }) => {
  await page.goto(`${MARKETING_URL}/`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bikin website bisnis Anda tanpa ngoding.");
  await expect(page.getByRole("link", { name: "Daftar gratis" })).toHaveAttribute("href", `${APP_URL}/register`);
  await page.getByRole("link", { name: "Daftar gratis" }).click();
  await expect(page).toHaveURL(`${APP_URL}/register`);
});

test.describe("tanpa JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const [host, base] of [
    ["app", APP_URL],
    ["apex", MARKETING_URL],
  ] as const) {
    test(`404 di host ${host}: status 404, teks ID + EN, tautan ke beranda`, async ({ page }) => {
      const response = await page.goto(`${base}/halaman-yang-tidak-ada`);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Halaman tidak ditemukan");
      await expect(page.getByText(/Page not found/)).toBeVisible();
      await expect(page.getByRole("link", { name: /Kembali ke beranda/ })).toHaveAttribute("href", "/");
    });
  }

  test("landing tetap utuh tanpa JS (statis)", async ({ page }) => {
    await page.goto(`${MARKETING_URL}/`);
    await expect(page.getByRole("link", { name: "Masuk" }).first()).toHaveAttribute("href", `${APP_URL}/login`);
  });
});
