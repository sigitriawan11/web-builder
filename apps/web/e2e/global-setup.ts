import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import pg from "pg";
import { APP_URL, E2E_DATABASE_URL } from "../playwright.config";
import { login, OWNER_ACCOUNT, OWNER_STATE, PASSWORD, register } from "./support/auth";
import { resetRateLimits } from "./support/stack";

// T1.16.4: global setup e2e — dijalankan SETELAH stack e2e (webServer) siap. Membuat satu user "owner" terverifikasi
// di DB `platform_e2e` (dibuat ulang tiap run) lalu menyimpan sesi login (`storageState`) agar test yang tidak menguji
// alur auth langsung mulai dari dashboard.
export default async function globalSetup(_config: FullConfig): Promise<void> {
  await resetRateLimits();
  const email = `e2e-owner-${Date.now().toString(36)}@platform.test`;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await register(page, email, PASSWORD, "Owner E2E");
    await page.waitForURL(/\/verify-email/);

    // Verifikasi email langsung di DB e2e (alur OTP diuji sendiri di auth.spec).
    const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
    await client.connect();
    try {
      await client.query("update users set email_verified = true where email = $1", [email]);
    } finally {
      await client.end();
    }

    // Sesi baru setelah verifikasi (cache sesi lama masih `emailVerified: false`).
    await context.clearCookies();
    await login(page, email, PASSWORD, "/sites");
    await page.waitForURL(`${APP_URL}/sites`);

    mkdirSync(dirname(OWNER_STATE), { recursive: true });
    await context.storageState({ path: OWNER_STATE });
    writeFileSync(OWNER_ACCOUNT, JSON.stringify({ email, password: PASSWORD }));
  } finally {
    await browser.close();
  }
}
