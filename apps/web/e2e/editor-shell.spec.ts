import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { register } from "./support/auth";
import { resetRateLimits, uniqueEmail } from "./support/stack";

// T1.15.5: bootstrap editor sungguhan (Vite) lewat web — rute `/editor/:siteId`, situs milik sendiri vs orang lain.
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

async function newUserWithSite(page: Page, name: string): Promise<string> {
  await register(page, uniqueEmail("editor"));
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  return page.evaluate(async (siteName) => {
    const workspaces = (await (await fetch("/api/v1/workspaces")).json()) as { data: { id: string }[] };
    const response = await fetch(`/api/v1/workspaces/${workspaces.data[0]?.id}/sites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: siteName }),
    });
    return ((await response.json()) as { data: { id: string } }).data.id;
  }, name);
}

test("situs milik sendiri → shell editor dengan nama situs & tombol kembali (AC T1.15.5)", async ({ page }) => {
  const siteId = await newUserWithSite(page, "Toko Kopi Sari");
  await page.goto(`${APP_URL}/editor/${siteId}?page=pg_home000001`);
  await expect(page.getByTestId("editor-site-name")).toHaveText("Toko Kopi Sari");
  await expect(page.getByTestId("editor-canvas-slot")).toHaveAttribute("data-page-id", "pg_home000001");
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(`${APP_URL}/sites`);
});

test("situs orang lain → halaman 404 editor (AC T1.15.5)", async ({ page, context }) => {
  const otherSiteId = await newUserWithSite(page, "Rahasia Milik A");
  await context.clearCookies();
  await register(page, uniqueEmail("intruder"));
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await page.goto(`${APP_URL}/editor/${otherSiteId}`);
  await expect(page.getByRole("heading", { name: "Website not found" })).toBeVisible();
  await expect(page.getByText("Rahasia Milik A")).toHaveCount(0);
  await page.getByRole("link", { name: "Back to websites" }).click();
  await expect(page).toHaveURL(`${APP_URL}/sites`);
});

test("ID tidak valid → 404; bahasa mengikuti cookie NEXT_LOCALE", async ({ page, context }) => {
  await newUserWithSite(page, "Situs");
  await page.goto(`${APP_URL}/editor/bukan-uuid`);
  await expect(page.getByRole("heading", { name: "Website not found" })).toBeVisible();
  await context.addCookies([{ name: "NEXT_LOCALE", value: "id", url: APP_URL }]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Website tidak ditemukan" })).toBeVisible();
});

test("ganti bahasa dari menu editor tanpa reload; tersimpan di profil (AC ED-221)", async ({ page }) => {
  const siteId = await newUserWithSite(page, "Toko Kopi Sari");
  await page.goto(`${APP_URL}/editor/${siteId}`);
  await expect(page.getByRole("link", { name: "Back to dashboard" })).toBeVisible();
  // Penanda di window: hilang bila halaman dimuat ulang.
  await page.evaluate(() => {
    (window as unknown as { __noReload: boolean }).__noReload = true;
  });
  await page.getByRole("button", { name: "Language" }).click();
  await page.getByRole("menuitem", { name: "Bahasa Indonesia" }).click();
  await expect(page.getByRole("link", { name: "Kembali ke dashboard" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "id");
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  await expect(page.getByTestId("editor-site-name")).toHaveText("Toko Kopi Sari");

  // Tersimpan di profil: dashboard ikut berbahasa Indonesia.
  await expect
    .poll(async () => page.evaluate(async () => (await (await fetch("/api/v1/account/profile")).json()).data.locale))
    .toBe("id");
  await page.goto(`${APP_URL}/sites`);
  await expect(page.getByRole("heading", { level: 1, name: "Website" })).toBeVisible();
});

test("sesi basi → editor mengarahkan ke login dengan next", async ({ context, page }) => {
  await context.addCookies([{ name: "platform.session_token", value: "basi", url: APP_URL }]);
  const siteId = "0199f0aa-1234-7abc-8def-0123456789ab";
  await page.goto(`${APP_URL}/editor/${siteId}`);
  await expect(page).toHaveURL(`${APP_URL}/login?next=${encodeURIComponent(`/editor/${siteId}`)}`);
});
