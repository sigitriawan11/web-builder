import { expect, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { login, PASSWORD, register } from "./support/auth";
import { resetRateLimits, uniqueEmail, waitForEmail } from "./support/stack";

// T1.14.5 (ACC-050): layout dashboard di stack e2e — sidebar, workspace, menu user, bahasa, keluar, banner verifikasi.
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

test("layout: navigasi, workspace pribadi, menu user, banner verifikasi + kirim ulang (AC T1.14.5)", async ({
  page,
}) => {
  const email = uniqueEmail("dash");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await page.goto(`${APP_URL}/sites`);

  await expect(page.getByRole("heading", { level: 1, name: "Websites" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Websites" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Account" })).toBeVisible();

  await page.getByRole("button", { name: "Workspace" }).click();
  await expect(page.getByRole("menuitem").filter({ hasText: "Personal" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menu")).toContainText("Sari Wulandari");
  await expect(page.getByRole("menu")).toContainText(email);
  await page.keyboard.press("Escape");

  // Belum terverifikasi → banner; kirim ulang memicu email kedua.
  const banner = page.getByRole("status").filter({ hasText: "Verify your email to publish websites." });
  await expect(banner).toBeVisible();
  await waitForEmail(email, /Verify your email/);
  await banner.getByRole("button", { name: "Resend email" }).click();
  await expect(page.getByText("Verification email sent again. Check your inbox.")).toBeVisible();
});

test("ganti bahasa ke Indonesia → UI berganti & tersimpan di profil (dipakai lagi saat login)", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("lang");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await page.goto(`${APP_URL}/sites`);

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Bahasa Indonesia" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Website" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");

  // Cookie dibuang, browser tetap EN: login memulihkan bahasa dari profil.
  await context.clearCookies();
  await login(page, email, PASSWORD);
  await expect(page).toHaveURL(`${APP_URL}/sites`);
  await expect(page.getByRole("heading", { level: 1, name: "Website" })).toBeVisible();
});

test("keluar → halaman login; dashboard tidak bisa dibuka lagi", async ({ page }) => {
  await register(page, uniqueEmail("out"));
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await page.goto(`${APP_URL}/sites`);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(`${APP_URL}/login`);
  await page.goto(`${APP_URL}/sites`);
  await expect(page).toHaveURL(`${APP_URL}/login?next=%2Fsites`);
});

test("cookie sesi basi (proxy lolos) → layout mengarahkan ke login", async ({ context, page }) => {
  await context.addCookies([{ name: "platform.session_token", value: "basi", url: APP_URL }]);
  await page.goto(`${APP_URL}/sites`);
  await expect(page).toHaveURL(`${APP_URL}/login`);
});
