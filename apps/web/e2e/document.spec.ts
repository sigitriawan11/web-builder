import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { register } from "./support/auth";
import "./support/editor";
import { resetRateLimits, uniqueEmail } from "./support/stack";

// T1.15.7: lifecycle Y.Doc editor — IndexedDB → token → Hocuspocus (stack e2e dengan realtime sungguhan).
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

async function openNewSite(page: Page): Promise<string> {
  await register(page, uniqueEmail("doc"));
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  const siteId = await page.evaluate(async () => {
    const workspaces = (await (await fetch("/api/v1/workspaces")).json()) as { data: { id: string }[] };
    const response = await fetch(`/api/v1/workspaces/${workspaces.data[0]?.id}/sites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Toko Dokumen" }),
    });
    return ((await response.json()) as { data: { id: string } }).data.id;
  });
  await page.goto(`${APP_URL}/editor/${siteId}`);
  return siteId;
}

const shell = (page: Page) => page.locator("[data-connection-status]");

test("dokumen situs dimuat dari server lewat realtime (page awal tampil, status synced)", async ({ page }) => {
  await openNewSite(page);
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  // Situs baru = satu page Home (bahasa UI pembuat = en).
  await expect(page.getByTestId("document-pages").locator("li")).toHaveText(["Home"]);
});

test("ubah dokumen → reload menampilkan state terakhir (AC T1.15.7)", async ({ page }) => {
  await openNewSite(page);
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  const pageId = await page.evaluate(() => window.__editorTest?.pageIds()[0] ?? "");
  expect(await page.evaluate((id) => window.__editorTest?.renamePage(id, "Beranda Baru"), pageId)).toBe(true);
  await expect(page.getByTestId("document-pages").locator("li")).toHaveText(["Beranda Baru"]);

  // Tersimpan ke server (flush realtime) lalu dimuat ulang.
  await page.waitForTimeout(1_500);
  await page.reload();
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  await expect(page.getByTestId("document-pages").locator("li")).toHaveText(["Beranda Baru"]);
});

test("perangkat lain (IndexedDB kosong) memuat state terakhir dari server", async ({ browser, page }) => {
  const siteId = await openNewSite(page);
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  const pageId = await page.evaluate(() => window.__editorTest?.pageIds()[0] ?? "");
  await page.evaluate((id) => window.__editorTest?.renamePage(id, "Dari Perangkat A"), pageId);
  await page.waitForTimeout(1_500);

  // Perangkat lain (IndexedDB kosong, cookie sesi sama) → state server.
  const other = await browser.newContext({ locale: "en-US", storageState: await page.context().storageState() });
  const otherPage = await other.newPage();
  await otherPage.goto(`${APP_URL}/editor/${siteId}`);
  await expect(otherPage.getByTestId("document-pages").locator("li")).toHaveText(["Dari Perangkat A"]);
  await other.close();
});
