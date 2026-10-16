import { expect, test } from "@playwright/test";
import { APP_URL, MARKETING_URL } from "../playwright.config";

// T1.14.3 / PUB-211: header keamanan platform pada halaman Next (nonce) & editor (lewat rewrite).
test.use({ locale: "en-US" });

test("halaman app: CSP nonce + strict-dynamic, script Next membawa nonce, tanpa pelanggaran CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text())) violations.push(message.text());
  });
  const response = await page.goto(`${APP_URL}/login`);
  const headers = response?.headers() ?? {};
  const csp = headers["content-security-policy"] ?? "";
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce).toBeTruthy();
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  // Lokal (APP_ENV=local) → tanpa HSTS.
  expect(headers["strict-transport-security"]).toBeUndefined();

  // Semua <script> di HTML server membawa nonce request ini. Script yang ditambahkan runtime oleh script tepercaya
  // (mis. klien HMR dev) tidak perlu nonce — diizinkan 'strict-dynamic'.
  const tags = (await response?.text())?.match(/<script[^>]*>/g) ?? [];
  expect(tags.length).toBeGreaterThan(0);
  expect(tags.every((tag) => tag.includes(`nonce="${nonce}"`))).toBe(true);
  await page.waitForLoadState("networkidle");
  expect(violations).toEqual([]);
});

test("nonce berbeda setiap request", async ({ page }) => {
  const nonceOf = async () =>
    /'nonce-([^']+)'/.exec((await page.goto(`${APP_URL}/login`))?.headers()["content-security-policy"] ?? "")?.[1];
  expect(await nonceOf()).not.toBe(await nonceOf());
});

test("editor (rewrite): CSP script-src 'self' tanpa nonce, script eksternal berjalan, header anti-frame", async ({
  context,
  page,
}) => {
  await context.addCookies([{ name: "platform.session_token", value: "dummy", url: APP_URL }]);
  const response = await page.goto(`${APP_URL}/editor/0199abc`);
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toMatch(/script-src 'self'( 'unsafe-inline')?;/);
  expect(headers["content-security-policy"]).not.toContain("nonce-");
  expect(headers["x-frame-options"]).toBe("DENY");
  // Editor sungguhan berjalan di bawah CSP itu (ID bukan situs → layar "tidak ditemukan" dirender aplikasi).
  await expect(page.getByRole("heading", { name: "Website not found" })).toBeVisible();
});

test("editor tidak bisa di-iframe, bahkan oleh origin sendiri (AC PUB-211)", async ({ context, page }) => {
  await context.addCookies([{ name: "platform.session_token", value: "dummy", url: APP_URL }]);
  // Induk di origin yang SAMA (cookie sesi ikut, jadi frame benar-benar meminta editor): 'none' menolak semua origin.
  await page.goto(`${APP_URL}/login`);
  const target = `${APP_URL}/editor/0199abc`;
  const editorResponse = page.waitForResponse(target);
  await page.evaluate((src) => {
    const frame = document.createElement("iframe");
    frame.src = src;
    document.body.append(frame);
  }, target);
  // Server memang menyajikan editor (200)…
  expect((await editorResponse).status()).toBe(200);
  await page.waitForTimeout(500);
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  // …tetapi browser menolak merendernya di frame: dokumen frame bukan editor dan script editor tidak berjalan.
  expect(child?.url()).not.toBe(target);
  const ran = await child
    ?.evaluate(() => ((document.getElementById("root")?.childElementCount ?? 0) > 0 ? "ya" : "tidak"))
    .catch(() => "tidak");
  expect(ran).toBe("tidak");
});

test("marketing: CSP tanpa nonce & tetap anti-frame", async ({ page }) => {
  const headers = (await page.goto(`${MARKETING_URL}/`))?.headers() ?? {};
  expect(headers["content-security-policy"]).not.toContain("nonce-");
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
});
