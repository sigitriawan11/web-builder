import { expect, test } from "@playwright/test";
import { APP_URL, MARKETING_URL } from "../playwright.config";

// T1.14.2: proxy Next.js — gate sesi, host routing, x-request-id (ARCHITECTURE §3.4).

test("akses /sites tanpa login → redirect /login?next=/sites (AC T1.14.2)", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await expect(page).toHaveURL(`${APP_URL}/login?next=%2Fsites`);
});

test("/editor/:id tanpa login → login dengan next berisi path & query", async ({ page }) => {
  await page.goto(`${APP_URL}/editor/0199f0aa?page=pg_1`);
  await expect(page).toHaveURL(`${APP_URL}/login?next=${encodeURIComponent("/editor/0199f0aa?page=pg_1")}`);
});

test("dengan cookie sesi → /sites tidak dialihkan; x-request-id dikembalikan", async ({ context, page }) => {
  await context.addCookies([{ name: "platform.session_token", value: "dummy", url: APP_URL }]);
  const response = await page.goto(`${APP_URL}/sites`);
  await expect(page).toHaveURL(`${APP_URL}/sites`);
  expect(response?.headers()["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
});

test("path aplikasi di host marketing → pindah ke host app.; `/` di app → /sites", async ({ page }) => {
  await page.goto(`${MARKETING_URL}/login`);
  await expect(page).toHaveURL(`${APP_URL}/login`);
  await page.goto(`${APP_URL}/`);
  await expect(page).toHaveURL(`${APP_URL}/login?next=%2Fsites`);
});

test("halaman marketing di apex tetap dilayani tanpa login", async ({ page }) => {
  const response = await page.goto(`${MARKETING_URL}/`);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(`${MARKETING_URL}/`);
});

test("x-request-id dari klien diteruskan apa adanya", async ({ page }) => {
  // Lewat browser (Node tidak me-resolve `app.localhost`).
  await page.setExtraHTTPHeaders({ "x-request-id": "req-e2e-1" });
  const response = await page.goto(`${APP_URL}/login`);
  expect(response?.headers()["x-request-id"]).toBe("req-e2e-1");
});
