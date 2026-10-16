import { expect, type Page, test } from "@playwright/test";
import { APP_URL, REALTIME_URL } from "../playwright.config";
import { register } from "./support/auth";
import "./support/editor";
import { addWorkspaceMember, resetRateLimits, uniqueEmail } from "./support/stack";

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

test("canvas merender page aktif dokumen situs lewat @platform/renderer (T1.15.8)", async ({ page }) => {
  await openNewSite(page);
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  const pageId = await page.evaluate(() => window.__editorTest?.pageIds()[0] ?? "");
  // Locator CSS Playwright menembus shadow root canvas (ADR-012).
  const pageNode = page.getByTestId("editor-canvas").locator(`[data-node-id="${pageId}"]`);
  await expect(pageNode).toBeAttached();
  expect(await pageNode.evaluate((element) => element.tagName)).toBe("MAIN");
  // Page selebar frame Desktop (1440) di world canvas.
  await expect(pageNode).toHaveCSS("width", "1440px");
  await expect(page.locator("#world")).toBeAttached();
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

test("undo hanya membatalkan perubahan sesi ini: setelah reload, Ctrl+Z tidak membatalkan perubahan sebelum reload (T1.15.10)", async ({
  page,
}) => {
  await openNewSite(page);
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  const pages = page.getByTestId("document-pages").locator("li");
  const pageId = await page.evaluate(() => window.__editorTest?.pageIds()[0] ?? "");
  const rename = (title: string) =>
    page.evaluate(({ id, value }) => window.__editorTest?.renamePage(id, value), { id: pageId, value: title });

  // Kontrol positif: di sesi yang sama Ctrl+Z membatalkan rename.
  await rename("Coba Undo");
  await expect(pages).toHaveText(["Coba Undo"]);
  await page.keyboard.press("Control+z");
  await expect(pages).toHaveText(["Home"]);
  await page.keyboard.press("Control+Shift+z");
  await expect(pages).toHaveText(["Coba Undo"]);

  await rename("Sebelum Reload");
  await page.waitForTimeout(1_500);
  await page.reload();
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  await expect(pages).toHaveText(["Sebelum Reload"]);

  // Stack undo tidak dipersist antar sesi; isi dari IndexedDB/server bukan origin lokal → tidak ter-undo.
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  await expect(pages).toHaveText(["Sebelum Reload"]);

  // Perubahan sesudah reload tetap bisa di-undo — sampai batas sesi ini saja.
  await rename("Sesudah Reload");
  await expect(pages).toHaveText(["Sesudah Reload"]);
  await page.keyboard.press("Control+z");
  await expect(pages).toHaveText(["Sebelum Reload"]);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(300);
  await expect(pages).toHaveText(["Sebelum Reload"]);
});

test("indikator autosave: edit → Tersimpan dikonfirmasi server; jaringan mati → Offline; hidup → Tersimpan (T1.15.11)", async ({
  page,
  context,
}) => {
  await openNewSite(page);
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  const indicator = page.getByTestId("save-status");
  await expect(indicator).toHaveAttribute("data-status", "saved");
  await expect(indicator).toHaveText("Saved");

  const pageId = await page.evaluate(() => window.__editorTest?.pageIds()[0] ?? "");
  await page.evaluate((id) => window.__editorTest?.renamePage(id, "Disimpan"), pageId);
  // Flush server (debounce 200 ms di stack e2e) → `saved` dengan clock tab ini.
  const unsaved = () => page.evaluate(() => window.__editorTest?.unsaved());
  expect(await unsaved()).toBe(true);
  await expect.poll(unsaved).toBe(false);
  await expect(indicator).toHaveAttribute("data-status", "saved");

  await context.setOffline(true);
  await expect(indicator).toHaveAttribute("data-status", "offline");
  await expect(indicator).toContainText("Offline — changes are kept on this device");
  // Edit saat offline tetap di perangkat; kembali online → terkirim & dikonfirmasi.
  await page.evaluate((id) => window.__editorTest?.renamePage(id, "Saat Offline"), pageId);
  await context.setOffline(false);
  await expect(indicator).toHaveAttribute("data-status", "saved", { timeout: 15_000 });
  await expect.poll(unsaved, { timeout: 15_000 }).toBe(false);

  // Mod+S tidak membuka dialog simpan browser; hanya memberi tahu.
  await page.keyboard.press("Control+s");
  await expect(page.getByRole("status").filter({ hasText: "All changes are saved automatically" })).toBeVisible();
});

test("crash recovery (ED-227): edit yang belum sampai server → tab ditutup paksa → dibuka lagi → dipulihkan & dikirim (T1.15.12)", async ({
  browser,
  context,
  page,
}) => {
  // Proxy WebSocket realtime: saat `blocked`, pesan editor → server dibuang (seperti jaringan putus sebelum terkirim).
  let blocked = false;
  await context.routeWebSocket(new RegExp(`^${REALTIME_URL}`), (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      if (!blocked) server.send(message);
    });
    server.onMessage((message) => ws.send(message));
  });
  const siteId = await openNewSite(page);
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  const pageId = await page.evaluate(() => window.__editorTest?.pageIds()[0] ?? "");

  blocked = true;
  await page.evaluate((id) => window.__editorTest?.renamePage(id, "Dipulihkan"), pageId);
  await expect(page.getByTestId("document-pages").locator("li")).toHaveText(["Dipulihkan"]);
  // Melewati debounce flush realtime (200 ms): tetap belum terkonfirmasi → memang tidak sampai server.
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__editorTest?.unsaved())).toBe(true);
  // Beri waktu tulis IndexedDB, lalu tutup tanpa beforeunload (≈ crash / tutup paksa).
  await page.waitForTimeout(300);
  await page.close({ runBeforeUnload: false });

  blocked = false;
  const reopened = await context.newPage();
  await reopened.goto(`${APP_URL}/editor/${siteId}`);
  await expect(reopened.getByTestId("document-pages").locator("li")).toHaveText(["Dipulihkan"]);
  await expect(shell(reopened)).toHaveAttribute("data-connection-status", "synced");
  await expect(reopened.getByTestId("recovery-banner")).toContainText("We recovered changes that hadn't been saved.");

  // Server menerima perubahan: perangkat lain (IndexedDB kosong) melihatnya.
  await reopened.waitForTimeout(1_500);
  const other = await browser.newContext({ locale: "en-US", storageState: await context.storageState() });
  const otherPage = await other.newPage();
  await otherPage.goto(`${APP_URL}/editor/${siteId}`);
  await expect(otherPage.getByTestId("document-pages").locator("li")).toHaveText(["Dipulihkan"]);
  await expect(otherPage.getByTestId("recovery-banner")).toHaveCount(0);
  await other.close();
});

test("banner offline tampil saat jaringan mati dan hilang saat online (ED-201)", async ({ page, context }) => {
  await openNewSite(page);
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  await expect(page.getByTestId("offline-banner")).toHaveCount(0);
  await context.setOffline(true);
  await expect(page.getByTestId("offline-banner")).toContainText("You're offline.");
  await context.setOffline(false);
  await expect(page.getByTestId("offline-banner")).toHaveCount(0, { timeout: 15_000 });
});

test("lock satu pengedit: user kedua → dialog takeover; ambil alih → user pertama jadi lihat saja (T1.15.14)", async ({
  browser,
  page,
}) => {
  const siteId = await openNewSite(page);
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");
  const workspaceId = await page.evaluate(
    async () => ((await (await fetch("/api/v1/workspaces")).json()) as { data: { id: string }[] }).data[0]?.id ?? "",
  );

  // User kedua, anggota editor workspace yang sama.
  const second = await browser.newContext({ locale: "en-US" });
  const other = await second.newPage();
  const otherEmail = uniqueEmail("lock");
  await register(other, otherEmail, undefined, "Budi Santoso");
  await expect(other).toHaveURL(/\/verify-email\?step=code/);
  await addWorkspaceMember(workspaceId, otherEmail, "editor");
  await other.goto(`${APP_URL}/editor/${siteId}`);

  const dialog = other.getByTestId("takeover-dialog");
  await expect(dialog).toContainText("Sari Wulandari is editing");
  await expect(other.getByTestId("read-only-blocker")).toBeVisible();
  const pageId = await other.evaluate(() => window.__editorTest?.pageIds()[0] ?? "");
  // Mode lihat saja: perubahan ditolak di klien (server juga menolak koneksi read-only).
  expect(await other.evaluate((id) => window.__editorTest?.renamePage(id, "Tidak boleh"), pageId)).toBe(false);

  await dialog.getByRole("button", { name: "Take over" }).click();
  await expect(dialog).toBeHidden();
  await expect(other.getByTestId("read-only-blocker")).toHaveCount(0);
  // Pemegang lama dijadikan lihat saja + ditawari mengambil alih kembali.
  await expect(page.getByTestId("takeover-dialog")).toContainText("Budi Santoso is editing");
  await expect(page.getByTestId("read-only-blocker")).toBeVisible();
  expect(await page.evaluate((id) => window.__editorTest?.renamePage(id, "Ditolak"), pageId)).toBe(false);

  // Pengedit baru mengubah dokumen → tersinkron ke koneksi lihat saja.
  expect(await other.evaluate((id) => window.__editorTest?.renamePage(id, "Diedit Budi"), pageId)).toBe(true);
  await expect(page.getByTestId("document-pages").locator("li")).toHaveText(["Diedit Budi"]);

  // "Lihat saja" menutup dialog, mode lihat saja tetap.
  await page.getByTestId("takeover-dialog").getByRole("button", { name: "View only" }).click();
  await expect(page.getByTestId("takeover-dialog")).toBeHidden();
  await expect(page.getByTestId("lock-banner")).toContainText("View-only mode — Budi Santoso is editing");

  // Budi menutup editor → lock dilepas → Sari ditawari mulai mengedit.
  await second.close();
  await expect(page.getByTestId("lock-banner")).toContainText("Budi Santoso has finished editing.");
  await page.getByTestId("lock-banner").getByRole("button", { name: "Start editing" }).click();
  await expect(page.getByTestId("lock-banner")).toHaveCount(0);
  expect(await page.evaluate((id) => window.__editorTest?.renamePage(id, "Kembali ke Sari"), pageId)).toBe(true);
});

test("sesi habis saat mengedit (401 token realtime) → dialog login ulang tanpa meninggalkan editor (ED-229)", async ({
  context,
  page,
}) => {
  let sockets: { close: () => Promise<void> }[] = [];
  await context.routeWebSocket(new RegExp(`^${REALTIME_URL}`), (ws) => {
    const server = ws.connectToServer();
    sockets.push({ close: () => ws.close() });
    ws.onMessage((message) => server.send(message));
    server.onMessage((message) => ws.send(message));
  });
  const siteId = await openNewSite(page);
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced");

  // Sesi login hilang lalu koneksi realtime putus → sambung ulang meminta token baru → 401.
  const cookies = await context.cookies();
  await context.clearCookies();
  for (const socket of sockets) await socket.close();
  sockets = [];
  const dialog = page.getByTestId("session-expired-dialog");
  await expect(dialog).toContainText("Your session has ended", { timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(`/editor/${siteId}`));

  // Login lagi (di sini: cookie dipulihkan) → Sambungkan ulang → tersinkron, dialog hilang.
  await context.addCookies(cookies);
  await dialog.getByRole("button", { name: "Reconnect" }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
  await expect(shell(page)).toHaveAttribute("data-connection-status", "synced", { timeout: 15_000 });
});
