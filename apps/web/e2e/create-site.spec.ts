import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { register } from "./support/auth";
import { resetRateLimits, uniqueEmail } from "./support/stack";

// T1.14.7 (ACC-051): dialog "Buat website" → Kosong → editor terbuka (stack e2e; editor = fixture origin).
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

async function openSitesAsNewUser(page: Page) {
  await register(page, uniqueEmail("create"));
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await page.goto(`${APP_URL}/sites`);
}

test("buat website kosong → URL editor situs baru; situs muncul di daftar (AC T1.14.7)", async ({ page }) => {
  await openSitesAsNewUser(page);
  await page.getByRole("button", { name: "Create website" }).click();
  const dialog = page.getByRole("dialog", { name: "Create a new website" });
  await expect(dialog).toBeVisible();

  // Template & AI belum tersedia; Kosong terpilih.
  await expect(dialog.getByRole("radio", { name: /From a template/ })).toBeDisabled();
  await expect(dialog.getByRole("radio", { name: /With AI/ })).toBeDisabled();
  await expect(dialog.getByRole("radio", { name: /Blank/ })).toBeChecked();
  await expect(dialog.getByText("Coming soon")).toHaveCount(2);

  await dialog.getByLabel("Website name").fill("Toko Kue Bu Sri");
  await dialog.getByRole("button", { name: "Create and open editor" }).click();
  await expect(page).toHaveURL(/\/editor\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  const siteId = page.url().split("/editor/")[1];
  await expect(page.getByTestId("editor-site-name")).toHaveText("Toko Kue Bu Sri");

  await page.goto(`${APP_URL}/sites`);
  await expect(page.getByRole("link", { name: "Open Toko Kue Bu Sri in the editor" })).toHaveAttribute(
    "href",
    `/editor/${siteId}`,
  );
});

test("nama wajib; Batal & Escape menutup dialog tanpa membuat situs", async ({ page }) => {
  await openSitesAsNewUser(page);
  await page.getByRole("button", { name: "Create website" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Create and open editor" }).click();
  // Validasi bawaan browser (`required`): tetap di dialog.
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Website name")).toHaveJSProperty("validity.valueMissing", true);

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Create website" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByTestId("sites-empty")).toBeVisible();
});
