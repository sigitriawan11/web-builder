import { expect, test } from "@playwright/test";
import { APP_URL, MARKETING_URL } from "../playwright.config";

// T1.15.3: next-intl di host app. — bahasa dari cookie NEXT_LOCALE → Accept-Language → id (ACC-290, ARCHITECTURE §5.1).
// Accept-Language browser diatur lewat `locale` konteks Playwright (header buatan sendiri ditimpa Chromium).

test.describe("browser EN", () => {
  test.use({ locale: "en-US" });

  test("halaman app berbahasa Inggris & <html lang=en> (AC T1.15.3)", async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to your account");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("marketing tetap statis berbahasa id", async ({ page }) => {
    await page.goto(`${MARKETING_URL}/`);
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
  });
});

test.describe("browser bahasa lain", () => {
  test.use({ locale: "fr-FR" });

  test("tanpa id/en di Accept-Language → default id", async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Masuk ke akun Anda");
    await expect(page.locator("html")).toHaveAttribute("lang", "id");
  });
});

test.describe("browser ID", () => {
  test.use({ locale: "id-ID" });

  test("Accept-Language id → bahasa Indonesia", async ({ page }) => {
    await page.goto(`${APP_URL}/login`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Masuk ke akun Anda");
  });

  test("cookie NEXT_LOCALE=en menang atas Accept-Language id", async ({ context, page }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: APP_URL }]);
    await page.goto(`${APP_URL}/login`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to your account");
  });
});

test("path tak dikenal → 404 global", async ({ page }) => {
  const missing = await page.goto(`${APP_URL}/tidak-ada-halaman-ini`);
  expect(missing?.status()).toBe(404);
});
