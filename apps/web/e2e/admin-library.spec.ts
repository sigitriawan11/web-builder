import { uuidv7 } from "@platform/shared";
import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { APP_URL, E2E_DATABASE_URL } from "../playwright.config";
import { register } from "./support/auth";
import { resetRateLimits, uniqueEmail } from "./support/stack";

// T3.8.1 (ACC-208): halaman admin `/admin/library` — daftar component (semua status) + filter, role-gated (non-staf →
// 404, permukaan tak bocor). Staf = super_admin disetel via DB (pola editor-admin-mode).
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

async function seedCategory(): Promise<string> {
  const id = uuidv7();
  await withDb((client) =>
    client.query(
      `insert into library_categories (id, slug, scope, type, name) values ($1, $2, 'component', 'functional', $3)`,
      [id, `e2e-adm-${id}`, JSON.stringify({ id: "Uji", en: "Test" })],
    ),
  );
  return id;
}

const definition = () => ({
  schemaVersion: 1,
  id: "cmp_e2eadmlib1",
  version: 1,
  name: "E2E Lib",
  category: "card" as const,
  propsSchema: [],
  rootId: "n_root0001",
  nodes: {
    n_root0001: {
      id: "n_root0001",
      type: "frame",
      name: "Root",
      parentId: null,
      visible: true,
      locked: false,
      tag: "div",
      children: [],
      style: { base: {} },
      props: {},
    },
  },
});

async function createComponentAsStaff(page: Page): Promise<{ id: string; publicId: string; name: string }> {
  const email = uniqueEmail("admlib");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await setStaffRole(email, "super_admin");
  const categoryId = await seedCategory();
  const name = `AdmList ${Date.now().toString(36)}`;
  const created = await page.evaluate(
    async ({ categoryId, def, slug, name }) => {
      const res = await fetch("/api/v1/admin/library/components", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          categoryId,
          kind: "element",
          name,
          displayName: { id: name, en: name },
          description: { id: "d", en: "d" },
          definition: def,
        }),
      });
      return { status: res.status, body: (await res.json()) as { data?: { id: string; publicId: string } } };
    },
    { categoryId, def: definition(), slug: `e2e-adm-${uuidv7()}`, name },
  );
  expect(created.status).toBe(201);
  return { id: created.body.data?.id ?? "", publicId: created.body.data?.publicId ?? "", name };
}

async function publish(page: Page, id: string): Promise<void> {
  const res = await page.evaluate(async (id) => {
    const r = await fetch(`/api/v1/admin/library/components/${id}/draft/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bump: "minor", changelog: { id: "Rilis", en: "Release" } }),
    });
    return r.status;
  }, id);
  expect(res).toBe(200);
}

test("staf: /admin/library menampilkan daftar + filter status", async ({ page }) => {
  const { publicId } = await createComponentAsStaff(page);

  await page.goto(`${APP_URL}/admin/library`);
  await expect(page.getByTestId("admin-library-table")).toBeVisible();
  const row = page.getByTestId(`admin-library-row-${publicId}`);
  await expect(row).toBeVisible();
  // Component baru = status draft.
  await expect(row).toContainText("Draft");

  // Filter draft → tetap tampil; published → hilang (belum dipublish).
  await page.getByTestId("admin-library-filter-draft").click();
  await expect(page.getByTestId(`admin-library-row-${publicId}`)).toBeVisible();
  await page.getByTestId("admin-library-filter-published").click();
  await expect(page.getByTestId(`admin-library-row-${publicId}`)).toBeHidden();
});

test("T3.8.2: detail component → versi + changelog + aksi deprecate", async ({ page }) => {
  const { id } = await createComponentAsStaff(page);
  await publish(page, id);

  await page.goto(`${APP_URL}/admin/library/${id}`);
  // Riwayat versi memuat versi published.
  await expect(page.getByTestId("admin-component-versions")).toBeVisible();
  await expect(page.getByTestId("admin-component-versions")).toContainText("0.1.0");
  await expect(page.getByTestId("admin-component-versions")).toContainText("Release");

  // Deprecate → status COMPONENT berubah (router.refresh); tombol deprecate jadi nonaktif.
  await page.getByTestId("admin-component-deprecate").click();
  await expect(page.getByTestId("admin-component-status")).toContainText("Deprecated");
  await expect(page.getByTestId("admin-component-deprecate")).toBeDisabled();
});

test("non-staf: /admin/library → 404 (permukaan admin tak bocor)", async ({ page }) => {
  await register(page, uniqueEmail("plain"));
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  const response = await page.goto(`${APP_URL}/admin/library`);
  expect(response?.status()).toBe(404);
  await expect(page.getByTestId("admin-library-table")).toBeHidden();
});
