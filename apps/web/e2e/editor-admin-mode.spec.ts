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

  // CMP-012: panel component kanan — tab Metadata/Versions/Usage/Props; Versions (status Draft), Usage (kosong).
  const panel = page.getByTestId("component-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("tab", { name: "Metadata" })).toBeVisible();
  await expect(panel.getByRole("tab", { name: "Props" })).toBeVisible();

  // CMP-013: super_admin bisa edit metadata → simpan → "Saved"; nilai bertahan setelah reload.
  await panel.getByLabel("Display name (EN)").fill("Edited CTA");
  await panel.getByLabel("Tags (comma-separated)").fill("cta, with-icon");
  await panel.getByRole("button", { name: "Save metadata" }).click();
  await expect(panel.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("admin-badge")).toBeVisible();
  await expect(page.getByTestId("component-panel").getByLabel("Display name (EN)")).toHaveValue("Edited CTA");

  await panel.getByRole("tab", { name: "Versions" }).click();
  await expect(panel.getByText("Draft", { exact: true })).toBeVisible();
  await panel.getByRole("tab", { name: "Usage" }).click();
  await expect(panel.getByText("Not used on any site yet.")).toBeVisible();
});

test("create component dari seleksi (CMP-011): seleksi → component baru + instance; konten tetap terlihat", async ({
  page,
}) => {
  const { componentId, marker } = await createComponentAsStaff(page);
  await page.goto(`${APP_URL}/editor/library/components/${componentId}/draft`);
  await expect(page.getByTestId("admin-badge")).toBeVisible();
  await expect(page.getByText(marker)).toBeVisible();

  // Pilih node teks (n_text0001 dari definisi) lewat hook test editor, lalu Ctrl+Alt+K → dialog.
  await page.waitForFunction(() => Boolean((window as unknown as { __editorTestApi?: unknown }).__editorTestApi));
  const selected = await page.evaluate(() => {
    const api = (window as unknown as { __editorTestApi?: { select(ids: string[]): void; getSelection(): string[] } })
      .__editorTestApi;
    api?.select(["n_text0001"]);
    return api?.getSelection();
  });
  expect(selected).toEqual(["n_text0001"]);
  await page.keyboard.press("Control+Alt+KeyK");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Name (PascalCase, EN)").fill("ExtractedText");
  await page.getByRole("button", { name: "Create component" }).click();

  // Dialog tertutup; posisi asal kini instance dari component baru (draft) → konten tetap ter-render (AC pixel-diff).
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.locator("[data-instance-id]")).toBeVisible();
  await expect(page.getByText(marker)).toBeVisible();
});

test("props & binding (CMP-020/021): tambah prop → bind visible node terpilih", async ({ page }) => {
  const { componentId, marker } = await createComponentAsStaff(page);
  await page.goto(`${APP_URL}/editor/library/components/${componentId}/draft`);
  await expect(page.getByTestId("admin-badge")).toBeVisible();
  await expect(page.getByText(marker)).toBeVisible();

  const panel = page.getByTestId("component-panel");
  await panel.getByRole("tab", { name: "Props" }).click();

  // Tambah prop boolean "showText".
  await panel.getByLabel("Key (camelCase)").fill("showText");
  await panel.getByRole("combobox").first().selectOption("boolean");
  await panel.getByRole("button", { name: "Add prop" }).click();
  await expect(panel.getByTestId("prop-list").getByText("showText").first()).toBeVisible();

  // Pilih node teks, lalu bind `visible` ke prop boolean.
  await page.waitForFunction(() => Boolean((window as unknown as { __editorTestApi?: unknown }).__editorTestApi));
  await page.evaluate(() =>
    (window as unknown as { __editorTestApi?: { select(ids: string[]): void } }).__editorTestApi?.select([
      "n_text0001",
    ]),
  );
  const visibleRow = panel.getByTestId("bind-Visible");
  await visibleRow.getByRole("combobox").selectOption("showText");
  await visibleRow.getByRole("button", { name: "Bind" }).click();

  // Baris menampilkan prop ter-bind + tombol Unbind; node tetap terlihat (visible={$prop} truthy).
  await expect(visibleRow.getByText("showText")).toBeVisible();
  await expect(visibleRow.getByRole("button", { name: "Unbind" })).toBeVisible();
  await expect(page.getByText(marker)).toBeVisible();

  // CMP-022: tambah prop list + tandai frame root sebagai repeater.
  await panel.getByLabel("Key (camelCase)").fill("items");
  await panel.getByRole("combobox").first().selectOption("list");
  await panel.getByRole("button", { name: "Add prop" }).click();
  await expect(panel.getByTestId("prop-list").getByText("items").first()).toBeVisible();

  await page.evaluate(() =>
    (window as unknown as { __editorTestApi?: { select(ids: string[]): void } }).__editorTestApi?.select([
      "n_root0001",
    ]),
  );
  const repeat = panel.getByTestId("repeat-control");
  await repeat.getByRole("combobox").selectOption("items");
  await repeat.getByRole("button", { name: "Set" }).click();
  await expect(repeat.getByText("items")).toBeVisible();

  // CMP-024: tab Access — atur izin Simple mode node (round-trip lewat command → doc).
  await panel.getByRole("tab", { name: "Access" }).click();
  await page.evaluate(() =>
    (window as unknown as { __editorTestApi?: { select(ids: string[]): void } }).__editorTestApi?.select([
      "n_text0001",
    ]),
  );
  const accessSelect = panel.getByTestId("access-editor").getByRole("combobox");
  await accessSelect.selectOption("content");
  await expect(accessSelect).toHaveValue("content");
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
