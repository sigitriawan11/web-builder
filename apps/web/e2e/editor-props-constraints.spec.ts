import { uuidv7 } from "@platform/shared";
import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { APP_URL, E2E_DATABASE_URL } from "../playwright.config";
import { register } from "./support/auth";
import { createSiteViaApi } from "./support/sites";
import { resetRateLimits, uniqueEmail } from "./support/stack";

// T3.4.8 (CMP-023/CMP-025) + T3.4.10 (CMP-033): Properties panel instance. Props dikelompokkan (group) & diurutkan
// (order), `advanced` tertutup default; teks menampilkan counter + peringatan kuning bila > softMaxLength; prop
// responsif menampilkan pemilih breakpoint.
test.describe.configure({ mode: "serial" });
test.use({ locale: "en-US" });
test.beforeEach(resetRateLimits);

const PUBLIC_ID = "cmp_propsconstraint";
const DEFINITION = {
  schemaVersion: 1,
  id: PUBLIC_ID,
  version: 1,
  name: "PropsConstraintDemo",
  category: "card",
  propsSchema: [
    {
      key: "title",
      label: { id: "Judul", en: "Title" },
      type: "text",
      default: "Hi",
      group: "content",
      order: 1,
      softMaxLength: 5,
    },
    { key: "note", label: { id: "Catatan", en: "Note" }, type: "text", default: "", group: "advanced", order: 3 },
    {
      key: "layout",
      label: { id: "Layout", en: "Layout" },
      type: "text",
      default: "row",
      group: "appearance",
      order: 2,
      responsiveProp: true,
    },
  ],
  rootId: "n_root0001",
  nodes: {
    n_root0001: {
      id: "n_root0001",
      type: "text",
      name: "Label",
      parentId: null,
      visible: true,
      locked: false,
      tag: "p",
      style: { base: { size: { width: { mode: "fill" }, height: { mode: "fixed", value: 40, unit: "px" } } } },
      props: { content: { $prop: "title" } },
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

async function seedComponent(): Promise<void> {
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
      [categoryId, `props-cat-${categoryId}`, JSON.stringify({ id: "Demo", en: "Demo" })],
    );
    const componentId = uuidv7();
    const versionId = uuidv7();
    await client.query(
      `insert into components (id, public_id, slug, owner_type, kind, category_id, name, display_name, description, status, latest_version, latest_version_id)
       values ($1,$2,$3,'platform','section',$4,'PropsConstraintDemo',$5,$6,'published','1.0.0',$7)`,
      [
        componentId,
        PUBLIC_ID,
        `props-${componentId}`,
        categoryId,
        JSON.stringify({ id: "Props", en: "Props" }),
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

async function insertInstance(page: Page): Promise<void> {
  const siteId = await createSiteViaApi(page, "Props Constraint Test");
  await page.goto(`${APP_URL}/editor/${siteId}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible({ timeout: 20000 });
  await page.getByTestId("left-tab-insert").click();
  const button = page.getByTestId("components-panel").getByTestId(`insert-component-${PUBLIC_ID}`);
  await expect(button).toBeVisible({ timeout: 15000 });
  await button.click();
}

test("CMP-025/023/033: group+order, advanced collapsed, soft-counter, breakpoint toggle", async ({ page }) => {
  await seedComponent();
  const email = uniqueEmail("props-user");
  await register(page, email);
  await expect(page).toHaveURL(/\/verify-email\?step=code/);
  await withDb((c) => c.query("update users set email_verified = true where email = $1", [email]));

  await insertInstance(page);
  const inspector = page.getByTestId("inspector");

  // CMP-025: group content + appearance tampil; advanced tertutup → prop `note` tersembunyi.
  await expect(inspector.getByTestId("instance-group-content")).toBeVisible();
  await expect(inspector.getByTestId("instance-group-appearance")).toBeVisible();
  await expect(inspector.getByTestId("instance-prop-title")).toBeVisible();
  await expect(inspector.getByTestId("instance-prop-note")).toHaveCount(0);

  // Buka advanced → prop `note` muncul.
  await inspector.getByTestId("instance-group-advanced-toggle").click();
  await expect(inspector.getByTestId("instance-prop-note")).toBeVisible();

  // CMP-023: ketik > softMaxLength (5) → counter kuning menampilkan panjang.
  await inspector.getByTestId("instance-prop-title").fill("ABCDEFG");
  const counter = inspector.getByTestId("instance-prop-counter-title");
  await expect(counter).toContainText("7/5");

  // CMP-033: prop responsif `layout` punya pemilih breakpoint.
  await expect(inspector.getByTestId("instance-prop-bp-layout")).toBeVisible();
  await inspector.getByTestId("instance-prop-bp-layout-tablet").click();
  await expect(inspector.getByTestId("instance-prop-bp-layout-tablet")).toHaveAttribute("aria-pressed", "true");
});
