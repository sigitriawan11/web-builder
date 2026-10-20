import { uuidv7 } from "@platform/shared";
import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { APP_URL, E2E_DATABASE_URL } from "../playwright.config";
import { register } from "./support/auth";
import { resetRateLimits, uniqueEmail } from "./support/stack";

// T3.4.2 "2a" (CMP-010/ED-003, Approach A): Mode Admin editor end-to-end. Staf membuka draft component (Yjs doc
// kind=component) → badge ADMIN + canvas me-render component; user biasa → tidak ditemukan (permukaan admin tak bocor).
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

const STAFF_ROLE = "super_admin";

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
      `insert into library_categories (id, slug, scope, type, name)
       values ($1, $2, 'component', 'functional', $3)`,
      [id, `e2e-cat-${id}`, JSON.stringify({ id: "Uji", en: "Test" })],
    ),
  );
  return id;
}

// Definisi component dengan teks literal agar terlihat saat dirender di canvas.
const definition = (marker: string) => ({
  schemaVersion: 1,
  id: "cmp_e2eadmin01",
  version: 1,
  name: "E2E Admin",
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
      children: ["n_text0001"],
      style: { base: {} },
      props: {},
    },
    n_text0001: {
      id: "n_text0001",
      type: "text",
      name: "Teks",
      parentId: "n_root0001",
      visible: true,
      locked: false,
      tag: "p",
      style: { base: {} },
      props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: marker }] }] } },
    },
  },
});

/** Daftar sebagai staf, seed kategori, buat component via API admin. Kembalikan UUID component + teks penanda. */
async function createComponentAsStaff(page: Page): Promise<{ componentId: string; marker: string }> {
  const email = uniqueEmail("staff");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await setStaffRole(email, STAFF_ROLE);
  const categoryId = await seedCategory();
  const marker = `Komponen E2E ${Date.now().toString(36)}`;
  const created = await page.evaluate(
    async ({ categoryId, def, slug }) => {
      const res = await fetch("/api/v1/admin/library/components", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          categoryId,
          kind: "element",
          name: "E2E Admin",
          displayName: { id: "E2E Admin", en: "E2E Admin" },
          description: { id: "d", en: "d" },
          definition: def,
        }),
      });
      return { status: res.status, body: (await res.json()) as { data?: { id: string } } };
    },
    { categoryId, def: definition(marker), slug: `e2e-admin-${uuidv7()}` },
  );
  expect(created.status).toBe(201);
  return { componentId: created.body.data?.id ?? "", marker };
}

test("staf: buka Mode Admin → badge ADMIN + canvas me-render component", async ({ page }) => {
  const { componentId, marker } = await createComponentAsStaff(page);
  await page.goto(`${APP_URL}/editor/library/components/${componentId}/draft`);
  await expect(page.getByTestId("admin-badge")).toBeVisible();
  // Canvas memuat draft Yjs & me-render dari rootId: teks component terlihat.
  await expect(page.getByText(marker)).toBeVisible();
});

test("user biasa (bukan staf): Mode Admin → tidak ditemukan (permukaan admin tak bocor)", async ({ page, context }) => {
  const { componentId, marker } = await createComponentAsStaff(page);
  await context.clearCookies();
  await register(page, uniqueEmail("plain"));
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await page.goto(`${APP_URL}/editor/library/components/${componentId}/draft`);
  await expect(page.getByRole("heading", { name: "Website not found" })).toBeVisible();
  await expect(page.getByTestId("admin-badge")).toHaveCount(0);
  await expect(page.getByText(marker)).toHaveCount(0);
});
