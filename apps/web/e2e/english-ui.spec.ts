import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import "./support/editor";

// M1.d exit criteria: UI web (app) & editor bisa diganti ke EN tanpa string Indonesia tersisa. Memindai teks yang
// TERLIHAT (bukan hanya katalog i18n) untuk kata Indonesia umum. Dikecualikan: elemen ber-`lang` selain en (nama
// bahasa "Bahasa Indonesia" di pemilih bahasa), data user (nama situs/page). Marketing EN = ditunda (temuan T1.14.9).
test.use({ locale: "en-US", storageState: OWNER_STATE });

const INDONESIAN = [
  "dan",
  "yang",
  "untuk",
  "dengan",
  "tidak",
  "atau",
  "anda",
  "kami",
  "masuk",
  "keluar",
  "daftar",
  "situs",
  "simpan",
  "tersimpan",
  "batal",
  "tutup",
  "buat",
  "hapus",
  "akun",
  "kata sandi",
  "beranda",
  "pengaturan",
  "bahasa",
  "muat",
  "ulang",
  "sedang",
  "perubahan",
  "halaman",
  "kembali",
  "lanjut",
  "gagal",
  "berhasil",
  "kirim",
  "email anda",
  "belum",
  "sudah",
  "lihat",
  "saja",
  "ambil",
  "alih",
  "elemen",
  "editor perlu",
  "coba",
  "sekarang",
  "tema",
  "terang",
  "gelap",
];

async function indonesianWordsOn(page: Page, ignore: readonly string[] = []): Promise<string[]> {
  const text = await page.evaluate(() => {
    const clone = document.body.cloneNode(true) as HTMLElement;
    for (const element of clone.querySelectorAll('[lang]:not([lang^="en"]), script, style, noscript')) element.remove();
    // Shadow root canvas (isi situs = konten user) tidak ikut dipindai.
    return clone.innerText;
  });
  let scanned = text.toLowerCase();
  for (const value of ignore) scanned = scanned.replaceAll(value.toLowerCase(), " ");
  return INDONESIAN.filter((word) => new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, "u").test(scanned));
}

test.beforeEach(async ({ context }) => {
  await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: APP_URL }]);
});

test("halaman app (dashboard, akun, auth) dalam EN tanpa kata Indonesia", async ({ browser, page }) => {
  for (const path of ["/sites", "/account"]) {
    await page.goto(`${APP_URL}${path}`);
    await page.waitForLoadState("networkidle");
    expect({ path, words: await indonesianWordsOn(page) }).toEqual({ path, words: [] });
  }
  // Halaman auth tanpa sesi.
  const anonymous = await browser.newContext({ locale: "en-US" });
  await anonymous.addCookies([{ name: "NEXT_LOCALE", value: "en", url: APP_URL }]);
  const guest = await anonymous.newPage();
  for (const path of ["/login", "/register", "/forgot-password"]) {
    await guest.goto(`${APP_URL}${path}`);
    await guest.waitForLoadState("networkidle");
    expect({ path, words: await indonesianWordsOn(guest) }).toEqual({ path, words: [] });
  }
  // 404 global sengaja statis & dwibahasa (T1.14.9: tanpa JS, tidak tahu bahasa user) — cukup EN-nya tersedia.
  await guest.goto(`${APP_URL}/halaman-tidak-ada`);
  await expect(guest.locator('[lang="en"]')).toContainText("Page not found");
  await anonymous.close();
});

test("editor dalam EN tanpa kata Indonesia: shell, toolbar dev, banner offline, layar error, situs tidak ditemukan", async ({
  context,
  page,
}) => {
  const siteName = "Website Test";
  await page.goto(`${APP_URL}/sites`);
  const siteId = await page.evaluate(async (name) => {
    const workspaces = (await (await fetch("/api/v1/workspaces")).json()) as { data: { id: string }[] };
    const response = await fetch(`/api/v1/workspaces/${workspaces.data[0]?.id}/sites`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return ((await response.json()) as { data: { id: string } }).data.id;
  }, siteName);
  await page.goto(`${APP_URL}/editor/${siteId}`);
  await expect(page.locator("[data-connection-status]")).toHaveAttribute("data-connection-status", "synced");
  const userData = [siteName, "Home"];
  expect(await indonesianWordsOn(page, userData)).toEqual([]);

  await context.setOffline(true);
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  expect(await indonesianWordsOn(page, userData)).toEqual([]);
  await context.setOffline(false);
  await expect(page.getByTestId("offline-banner")).toHaveCount(0, { timeout: 15_000 });

  await page.evaluate(() => window.__editorTestApi?.crash());
  await expect(page.getByTestId("error-id")).toBeVisible();
  expect(await indonesianWordsOn(page, userData)).toEqual([]);

  await page.goto(`${APP_URL}/editor/0199abc`);
  await expect(page.getByRole("heading", { name: "Website not found" })).toBeVisible();
  expect(await indonesianWordsOn(page)).toEqual([]);
});
