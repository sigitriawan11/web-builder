import { expect, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";

// T1.15.4: @platform/ui (Tailwind v4 + token platform) di web & tema chrome ED-012 (ikuti OS / dipaksa).
const CATALOG = `${APP_URL}/dev/ui`;
const bodyBackground = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.use({ locale: "en-US" });

test("katalog merender komponen dengan token (Tailwind aktif), tanpa pelanggaran CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(CATALOG);
  const primary = page.getByRole("button", { name: "Default" });
  await expect(primary).toHaveCSS("background-color", "rgb(79, 70, 229)");
  await expect(primary).toHaveCSS("color", "rgb(255, 255, 255)");
  expect(await bodyBackground(page)).toBe("rgb(255, 255, 255)");
  await expect(page.getByRole("checkbox")).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});

test("pilih Gelap → kelas `dark` & warna gelap; tersimpan di cookie & dirender server", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(CATALOG);
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  expect(await bodyBackground(page)).toBe("rgb(9, 9, 11)");

  // Muat ulang: HTML server sudah membawa kelas `dark` (tanpa kedip terang).
  const response = await page.reload();
  expect(await response?.text()).toMatch(/<html[^>]*class="dark"/);
  await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
});

test("ikuti sistem: OS gelap → gelap; dipaksa Terang mengalahkan OS gelap", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(CATALOG);
  expect(await bodyBackground(page)).toBe("rgb(9, 9, 11)");
  await page.getByRole("radio", { name: "Light" }).click();
  await expect(page.locator("html")).toHaveClass(/\blight\b/);
  expect(await bodyBackground(page)).toBe("rgb(255, 255, 255)");
  await page.getByRole("radio", { name: "Follow system" }).click();
  expect(await bodyBackground(page)).toBe("rgb(9, 9, 11)");
});
