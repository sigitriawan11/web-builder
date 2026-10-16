import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { login, PASSWORD, register } from "./support/auth";
import { linkIn, resetRateLimits, uniqueEmail, waitForEmail } from "./support/stack";

// T1.14.4: halaman auth melawan stack e2e sungguhan (api + worker + DB `platform_e2e` + Mailpit) — ACC-001/003/004/005.
// Serial: semua test berbagi satu IP (rate limit per IP) & Redis e2e.
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

// Komponen Alert @platform/ui (Next dev juga punya `role="alert"`: pengumum rute).
const formAlert = (page: Page) => page.locator('[data-slot="alert"]');

test("alur lengkap: daftar → kode verifikasi dari Mailpit → masuk → lupa password → reset → masuk (AC T1.14.4)", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("flow");
  await register(page, email);
  // User baru langsung mendapat sesi → halaman kode verifikasi.
  await expect(page).toHaveURL(`${APP_URL}/verify-email?step=code`);

  const verification = await waitForEmail(email, /Verify your email/);
  const code = verification.text.match(/\b\d{6}\b/)?.[0] ?? "";
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel("Verification code").fill(code);
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("Your email is verified.")).toBeVisible();

  // Keluar (hapus cookie) lalu masuk dengan password → dashboard (`/` → `/sites`).
  await context.clearCookies();
  await login(page, email, PASSWORD);
  await expect(page).toHaveURL(`${APP_URL}/sites`);

  // Lupa password → email reset → tautan → password baru.
  await context.clearCookies();
  await page.goto(`${APP_URL}/forgot-password`);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/If the email is registered/)).toBeVisible();
  const reset = await waitForEmail(email, /Reset your password/);
  await page.goto(linkIn(reset.text, "/reset-password/"));
  await expect(page).toHaveURL(/\/reset-password\?token=/);
  const newPassword = "Teh-Tarik-Hangat-2026";
  await page.getByLabel("New password").fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByText(/Password changed/)).toBeVisible();

  // Password lama ditolak (pesan generik), password baru diterima.
  await login(page, email, PASSWORD);
  await expect(formAlert(page)).toHaveText("Incorrect email or password.");
  await login(page, email, newPassword);
  await expect(page).toHaveURL(`${APP_URL}/sites`);
});

test("verifikasi lewat tautan email → halaman berhasil", async ({ page }) => {
  const email = uniqueEmail("link");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  const verification = await waitForEmail(email, /Verify your email/);
  await page.goto(linkIn(verification.text, "/verify-email?token="));
  await expect(page).toHaveURL(`${APP_URL}/verify-email`);
  await expect(page.getByText("Your email is verified.")).toBeVisible();
});

test("email sudah terdaftar → pesan generik tanpa sesi (tidak membocorkan akun)", async ({ page, context }) => {
  const email = uniqueEmail("dup");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await context.clearCookies();
  await register(page, email);
  await expect(page.getByText(/If this email isn't registered yet/)).toBeVisible();
  expect((await context.cookies()).some((cookie) => cookie.name.includes("session_token"))).toBe(false);
});

test("password umum ditolak dengan alasan; S&K wajib dicentang", async ({ page }) => {
  await register(page, uniqueEmail("weak"), "password123");
  await expect(formAlert(page)).toHaveText("This password is too common. Choose another one.");

  await page.goto(`${APP_URL}/register`);
  await page.getByLabel("Name").fill("Budi");
  await page.getByLabel("Email").fill(uniqueEmail("terms"));
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(formAlert(page)).toHaveText(/You need to accept the Terms of Service/);
});

test("login: pesan generik; `next` eksternal diabaikan (open redirect); Turnstile setelah 3 gagal", async ({
  page,
  context,
}) => {
  const email = uniqueEmail("login");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await context.clearCookies();

  await login(page, email, PASSWORD, "https://evil.example/curi");
  await expect(page).toHaveURL(`${APP_URL}/sites`);
  await context.clearCookies();

  for (let attempt = 1; attempt <= 3; attempt++) {
    await login(page, email, "salah-salah-salah");
    await expect(formAlert(page)).toHaveText("Incorrect email or password.");
  }
  // Percobaan ke-4: server minta captcha → widget muncul.
  await login(page, email, "salah-salah-salah");
  await expect(page.getByText(/Complete the verification below/)).toBeVisible();
  await expect(page.getByTestId("turnstile")).toBeAttached();
});

test("tautan kedaluwarsa / tidak valid", async ({ page }) => {
  await page.goto(`${APP_URL}/verify-email?error=token_expired`);
  await expect(page.getByText(/verification link has expired/)).toBeVisible();
  await page.goto(`${APP_URL}/reset-password?error=INVALID_TOKEN`);
  await expect(page.getByText(/reset link is invalid or has expired/)).toBeVisible();
  await page.getByRole("link", { name: "Request a new link" }).click();
  await expect(page).toHaveURL(`${APP_URL}/forgot-password`);
});

test("halaman persetujuan tanpa sesi → login dengan next", async ({ page }) => {
  await page.goto(`${APP_URL}/consent?next=%2Fsites`);
  await expect(page).toHaveURL(`${APP_URL}/login?next=%2Fsites`);
});
