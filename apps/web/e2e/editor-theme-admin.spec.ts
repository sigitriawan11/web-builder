import { uuidv7 } from "@platform/shared";
import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { APP_URL, E2E_DATABASE_URL } from "../playwright.config";
import { register } from "./support/auth";
import { resetRateLimits, uniqueEmail } from "./support/stack";

// Theme minimal yang valid terhadap ThemeSchema (warna hex flat agar bisa diedit di form). Dibangun inline karena
// e2e web tidak boleh mengimpor @platform/document-model.
const SEED_THEME = {
  tokens: {
    color: {
      primary: "#2563eb",
      onPrimary: "#ffffff",
      background: "#ffffff",
      surface: "#f8fafc",
      onSurface: "#111827",
      muted: "#6b7280",
      border: "#e5e7eb",
    },
    typography: {},
    fontFamily: {},
    space: {},
    radius: {},
    shadow: {},
  },
  fonts: [],
};

// T3.4.16 (CMP-124): edit theme preset di Mode Admin. Staf (designer/library_admin) membuka preset → form warna +
// pratinjau; ubah warna & Simpan → version naik. User biasa → tidak ditemukan (permukaan admin tak bocor).
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function setStaffRole(email: string, role: string): Promise<void> {
  await withDb((client) =>
    client.query("update users set staff_role = $1, email_verified = true where email = $2", [role, email]),
  );
}

/** Seed preset theme platform (published) dengan definisi Theme lengkap. Kembalikan slug. */
async function seedTheme(): Promise<string> {
  // Ekor UUIDv7 = bit acak (prefix = timestamp, bisa sama antar test) → pakai ekor agar slug unik.
  const slug = `e2e-theme-${uuidv7().replace(/-/g, "").slice(-16)}`;
  await withDb((client) =>
    client.query(
      `insert into themes (id, slug, owner_type, display_name, tokens, mode, status)
       values ($1, $2, 'platform', $3, $4, 'light', 'published')`,
      [uuidv7(), slug, JSON.stringify({ id: "Preset E2E", en: "E2E Preset" }), JSON.stringify(SEED_THEME)],
    ),
  );
  return slug;
}

async function registerStaff(page: Page, role: string): Promise<void> {
  const email = uniqueEmail("theme-staff");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await setStaffRole(email, role);
}

test("staf designer: edit preset warna → Simpan menaikkan version", async ({ page }) => {
  const slug = await seedTheme();
  await registerStaff(page, "designer");

  await page.goto(`${APP_URL}/editor/library/themes/${slug}`);
  // Cold start editor + query pertama bisa > 5s default.
  await expect(page.getByTestId("admin-badge")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("theme-editor")).toBeVisible();
  await expect(page.getByTestId("theme-preview")).toBeVisible();

  // Ubah token warna pertama ke hex baru, lalu Simpan.
  const firstHex = page.locator('[data-testid^="theme-hex-"]').first();
  await expect(firstHex).toBeVisible();
  await firstHex.fill("#123456");
  await page.getByTestId("theme-save").click();

  // Preset tersimpan → version naik dari 1 ke 2.
  await expect(page.getByTestId("theme-saved")).toContainText("2");
});

test("user biasa (bukan staf) → tidak ditemukan", async ({ page }) => {
  const slug = await seedTheme();
  const email = uniqueEmail("theme-plain");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);

  await page.goto(`${APP_URL}/editor/library/themes/${slug}`);
  await expect(page.getByTestId("theme-editor")).toHaveCount(0);
});
