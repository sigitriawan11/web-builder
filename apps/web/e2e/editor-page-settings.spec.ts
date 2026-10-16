import { expect, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.3.2 / ED-033: pengaturan page.
test.use({ locale: "en-US", storageState: OWNER_STATE });

test("judul, path (normalisasi + validasi unik/format), SEO + pratinjau snippet terpotong", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Page Settings Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  // Page kedua lalu buka pengaturannya dari menu ⋯.
  await page.getByTestId("page-add").click();
  const row = page.getByTestId("page-row").nth(1);
  await row.hover();
  await row.getByTestId("page-actions").click();
  await page.getByRole("menuitem", { name: "Page settings" }).click();
  const settings = page.getByTestId("page-settings");
  await expect(settings).toBeVisible();

  await settings.getByLabel("Page title").fill("Tentang Kami");
  await settings.getByLabel("Page title").press("Enter");
  await expect(row).toHaveText("Tentang Kami");

  const path = settings.getByLabel("Path (URL)");
  await path.fill("Tentang Kami Lengkap");
  await path.press("Enter");
  await expect(path).toHaveValue("/tentang-kami-lengkap");

  // Bentrok dengan "/" (khusus home) & format → pesan, nilai lama tetap.
  await path.fill("/");
  await path.press("Enter");
  await expect(settings.getByRole("alert")).toHaveText("/ is reserved for the home page.");
  await path.press("Escape");
  await expect(path).toHaveValue("/tentang-kami-lengkap");

  // SEO + snippet (AC ED-033: terpotong sesuai panjang).
  const longTitle = "Tentang Toko Kue Bu Sari — kue lapis legit, bolu, dan jajanan pasar khas Jakarta sejak 1998";
  await settings.getByLabel("SEO title").fill(longTitle);
  await settings.getByLabel("SEO title").press("Enter");
  const previewTitle = settings.getByTestId("seo-preview-title");
  await expect(previewTitle).toHaveText(/…$/);
  expect(((await previewTitle.textContent()) ?? "").length).toBeLessThanOrEqual(60);
  await settings.getByLabel("Meta description").fill("Kue rumahan tanpa pengawet.");
  await settings.getByLabel("Meta description").blur();
  await expect(settings.getByTestId("seo-preview-description")).toHaveText("Kue rumahan tanpa pengawet.");
  await expect(settings.getByTestId("seo-preview")).toContainText("/tentang-kami-lengkap");

  // Home: path terkunci di "/".
  await page.getByTestId("page-row").first().getByRole("button", { name: "Home", exact: true }).click();
  await expect(settings.getByLabel("Path (URL)")).toBeDisabled();
  await expect(settings.getByLabel("Path (URL)")).toHaveValue("/");

  // Tersimpan di dokumen (reload).
  await page.reload();
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  const doc = (await page.evaluate(() => window.__editorTestApi?.getDoc())) as {
    nodes: Record<
      string,
      { props?: { title?: string; path?: string; seo?: { title?: string; description?: string } } }
    >;
  };
  const about = Object.values(doc.nodes).find((node) => node.props?.title === "Tentang Kami");
  expect(about?.props).toMatchObject({
    path: "/tentang-kami-lengkap",
    seo: { title: longTitle, description: "Kue rumahan tanpa pengawet." },
  });
});
