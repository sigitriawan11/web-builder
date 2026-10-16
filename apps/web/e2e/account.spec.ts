import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { login, PASSWORD, register } from "./support/auth";
import { resetRateLimits, uniqueEmail, waitForEmail } from "./support/stack";

// T1.14.8 (ACC-007/008/009): halaman akun di stack e2e.
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

async function openAccountAsNewUser(page: Page, email = uniqueEmail("acct")) {
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await page.goto(`${APP_URL}/account`);
  return email;
}

test("ganti bahasa ke Indonesia → UI ID & tersimpan di profil (AC T1.14.8)", async ({ page, context }) => {
  const email = await openAccountAsNewUser(page);
  await expect(page.getByRole("heading", { level: 1, name: "Account" })).toBeVisible();
  await page.getByLabel("Language").selectOption("id");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Akun" })).toBeVisible();
  await expect(page).toHaveURL(`${APP_URL}/account`);
  await expect(page.locator("html")).toHaveAttribute("lang", "id");

  await context.clearCookies();
  await login(page, email, PASSWORD, "/account");
  await expect(page.getByRole("heading", { level: 1, name: "Akun" })).toBeVisible();
});

test("zona waktu & nama tersimpan", async ({ page, context }) => {
  await openAccountAsNewUser(page);
  await page.getByLabel("Time zone").selectOption("Asia/Makassar");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByLabel("Time zone")).toHaveValue("Asia/Makassar");
  const zone = (await context.cookies()).find((cookie) => cookie.name === "NEXT_TIMEZONE");
  expect(decodeURIComponent(zone?.value ?? "")).toBe("Asia/Makassar");

  await page.getByLabel("Name", { exact: true }).fill("Sari Putri");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Sari Putri");
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menu")).toContainText("Sari Putri");
});

test("ganti email: password salah ditolak; benar → tautan konfirmasi ke alamat BARU", async ({ page }) => {
  const email = await openAccountAsNewUser(page);
  const newEmail = uniqueEmail("baru");
  await page.getByRole("button", { name: "Change email" }).click();
  await page.getByLabel("New email").fill(newEmail);
  await page.getByLabel("Current password").fill("bukan-password-ini");
  await page.getByRole("button", { name: "Send confirmation link" }).click();
  await expect(page.getByText("Incorrect password. Enter your account password.")).toBeVisible();

  await page.getByLabel("Current password").fill(PASSWORD);
  await page.getByRole("button", { name: "Send confirmation link" }).click();
  await expect(page.getByText(/We sent a confirmation link to the new email/)).toBeVisible();
  await waitForEmail(newEmail, /Confirm your new email address/);
  // Email lama tetap aktif sampai tautan diklik.
  await expect(page.getByTestId("account-email")).toHaveText(email);
});

test("sesi aktif: perangkat lain tampil & bisa dikeluarkan → perangkat itu harus masuk lagi", async ({
  page,
  browser,
}) => {
  const email = await openAccountAsNewUser(page);
  const other = await browser.newContext({ locale: "en-US" });
  const otherPage = await other.newPage();
  await login(otherPage, email, PASSWORD);
  await expect(otherPage).toHaveURL(`${APP_URL}/sites`);

  await page.reload();
  const rows = page.getByTestId("session-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "This device" })).toHaveCount(1);
  await expect(rows.first()).toContainText(/Chrome/);

  await page.getByRole("button", { name: "Sign out of all other devices" }).click();
  await expect(page.getByText("1 other device signed out.")).toBeVisible();
  await expect(rows).toHaveCount(1);

  await otherPage.goto(`${APP_URL}/sites`);
  await expect(otherPage).toHaveURL(`${APP_URL}/login`);
  await other.close();
});
