import { uuidv7 } from "@platform/shared";
import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { APP_URL, E2E_DATABASE_URL } from "../playwright.config";
import { register } from "./support/auth";
import { createSiteViaApi } from "./support/sites";
import { resetRateLimits, uniqueEmail } from "./support/stack";

// T3.4.15 (CMP-073): "Edit main component". Staf admin library yang memilih instance di situs melihat tombol "Edit
// komponen utama" → membuka draft (dari versi published) di tab baru. User biasa tak pernah melihat tombol itu.
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

const PUBLIC_ID = "cmp_editmain01";
const DEFINITION = {
  schemaVersion: 1,
  id: PUBLIC_ID,
  version: 1,
  name: "EditMainDemo",
  category: "card",
  propsSchema: [{ key: "title", label: { id: "Judul", en: "Title" }, type: "text", default: "Hi" }],
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
      style: { base: { size: { width: { mode: "fill" }, height: { mode: "fixed", value: 60, unit: "px" } } } },
      props: {},
    },
  },
};

async function withDb<T>(fn: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Seed component published PLATFORM tanpa draft (seperti seed) — edit-main harus membuat draft dari published. */
async function seedPublished(): Promise<void> {
  await withDb(async (client) => {
    await client.query("update components set latest_version_id = null where public_id = $1", [PUBLIC_ID]);
    await client.query(
      "delete from component_versions where component_id in (select id from components where public_id = $1)",
      [PUBLIC_ID],
    );
    await client.query("delete from components where public_id = $1", [PUBLIC_ID]);
    const categoryId = uuidv7();
    await client.query(
      `insert into library_categories (id, slug, scope, type, name) values ($1,$2,'component','functional',$3)
       on conflict do nothing`,
      [categoryId, `editmain-cat-${categoryId}`, JSON.stringify({ id: "Demo", en: "Demo" })],
    );
    const componentId = uuidv7();
    const versionId = uuidv7();
    await client.query(
      `insert into components (id, public_id, slug, owner_type, kind, category_id, name, display_name, description, status, latest_version, latest_version_id)
       values ($1,$2,$3,'platform','section',$4,'EditMainDemo',$5,$6,'published','1.0.0',$7)`,
      [
        componentId,
        PUBLIC_ID,
        `editmain-${componentId}`,
        categoryId,
        JSON.stringify({ id: "EditMainDemo", en: "EditMainDemo" }),
        JSON.stringify({ id: "d", en: "d" }),
        versionId,
      ],
    );
    await client.query(
      `insert into component_versions (id, component_id, version, version_seq, status, definition, changelog)
       values ($1,$2,'1.0.0',1,'published',$3,$4)`,
      [versionId, componentId, JSON.stringify(DEFINITION), JSON.stringify({ id: "r", en: "r" })],
    );
  });
}

async function setStaffRole(email: string, role: string): Promise<void> {
  await withDb((client) =>
    client.query("update users set staff_role = $1, email_verified = true where email = $2", [role, email]),
  );
}

async function verifyEmail(email: string): Promise<void> {
  await withDb((client) => client.query("update users set email_verified = true where email = $1", [email]));
}

/** Buka editor situs baru + sisipkan instance dari panel Components; kembalikan id node instance terpilih. */
async function insertInstance(page: Page): Promise<string> {
  const siteId = await createSiteViaApi(page, "Edit Main Test");
  await page.goto(`${APP_URL}/editor/${siteId}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible({ timeout: 20000 });
  await page.getByTestId("left-tab-insert").click();
  const button = page.getByTestId("components-panel").getByTestId(`insert-component-${PUBLIC_ID}`);
  await expect(button).toBeVisible({ timeout: 15000 });
  await button.click();
  const selected = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  expect(selected).toBeTruthy();
  return selected;
}

test("staf admin: Edit komponen utama → draft terbuka di tab baru", async ({ page }) => {
  await seedPublished();
  const email = uniqueEmail("editmain-admin");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await setStaffRole(email, "library_admin");

  await insertInstance(page);

  const editMain = page.getByTestId("inspector").getByTestId("instance-edit-main");
  await expect(editMain).toBeVisible();
  const popupPromise = page.context().waitForEvent("page");
  await editMain.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/editor\/library\/components\/[0-9a-f-]+\/draft$/);
  await expect(popup.getByTestId("admin-badge")).toBeVisible({ timeout: 15000 });
});

test("user biasa: tombol Edit komponen utama tidak muncul", async ({ page }) => {
  await seedPublished();
  const email = uniqueEmail("editmain-plain");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await verifyEmail(email);

  await insertInstance(page);

  // Instance terpilih → panel props terlihat, tapi tanpa tombol edit-main (non-admin).
  await expect(page.getByTestId("inspector").getByTestId("instance-detach")).toBeVisible();
  await expect(page.getByTestId("inspector").getByTestId("instance-edit-main")).toHaveCount(0);
});

test("ED-157 Go to main: panel info + Kembali ke instance (admin: Buka di Admin mode)", async ({ page }) => {
  await seedPublished();
  const email = uniqueEmail("gotomain-admin");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await setStaffRole(email, "library_admin");

  await insertInstance(page);
  const inspector = page.getByTestId("inspector");

  // "Lihat komponen utama" → panel info (versi) + tautan Admin + "Kembali ke instance".
  await inspector.getByTestId("instance-go-to-main").click();
  const info = inspector.getByTestId("instance-main-info");
  await expect(info).toBeVisible();
  await expect(info).toContainText("1");
  await expect(inspector.getByTestId("instance-open-admin")).toBeVisible();

  // "Kembali ke instance" menutup panel (seperti Figma).
  await inspector.getByTestId("instance-back-to-instance").click();
  await expect(inspector.getByTestId("instance-main-info")).toHaveCount(0);
  await expect(inspector.getByTestId("instance-go-to-main")).toBeVisible();
});
