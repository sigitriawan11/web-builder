import { uuidv7 } from "@platform/shared";
import { expect, type Page, test } from "@playwright/test";
import pg from "pg";
import { APP_URL, E2E_DATABASE_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { firstPageId } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T3.6.1 / ED-151: panel Components di editor situs — daftar component library published, klik → sisip instance.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const PUBLIC_ID = "cmp_insdemo01";
const DEFINITION = {
  schemaVersion: 1,
  id: PUBLIC_ID,
  version: 1,
  name: "InsertDemo",
  category: "card",
  propsSchema: [{ key: "title", label: { id: "Judul", en: "Title" }, type: "text", default: "Hello" }],
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
};

interface DNode {
  type: string;
  props?: { componentId?: string; version?: number; propValues?: Record<string, unknown> };
}
const doc = (page: Page) => page.evaluate(() => window.__editorTestApi?.getDoc() as { nodes: Record<string, DNode> });

test.beforeAll(async () => {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    const categoryId = uuidv7();
    await client.query(
      `insert into library_categories (id, slug, scope, type, name) values ($1,$2,'component','functional',$3)
       on conflict do nothing`,
      [categoryId, `insdemo-cat-${categoryId}`, JSON.stringify({ id: "Demo", en: "Demo" })],
    );
    const componentId = uuidv7();
    const versionId = uuidv7();
    await client.query(
      `insert into components (id, public_id, slug, owner_type, kind, category_id, name, display_name, description, status, latest_version, latest_version_id)
       values ($1,$2,$3,'platform','section',$4,$5,$6,$7,'published','1.0.0',$8)`,
      [
        componentId,
        PUBLIC_ID,
        `insdemo-${componentId}`,
        categoryId,
        "InsertDemo",
        JSON.stringify({ id: "Demo Sisip", en: "Insert Demo" }),
        JSON.stringify({ id: "d", en: "d" }),
        versionId,
      ],
    );
    // content_hash null → endpoint read lewati verifikasi integritas (CMP-044); test ini hanya cek penyisipan instance.
    await client.query(
      `insert into component_versions (id, component_id, version, version_seq, status, definition, changelog)
       values ($1,$2,'1.0.0',1,'published',$3,$4)`,
      [versionId, componentId, JSON.stringify(DEFINITION), JSON.stringify({ id: "r", en: "r" })],
    );
  } finally {
    await client.end();
  }
});

test("T3.6.1/T3.6.4: insert instance dari panel Components + edit prop lewat Inspector", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Insert Component Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  const pageId = await firstPageId(page);

  await page.getByTestId("left-tab-insert").click();
  const components = page.getByTestId("components-panel");
  const button = components.getByTestId(`insert-component-${PUBLIC_ID}`);
  await expect(button).toBeVisible();
  await button.click();

  // Instance ter-sisip ke page aktif (createInstance), merujuk versi published yang di-pin.
  const selected = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  const node = (await doc(page)).nodes[selected];
  expect(node).toMatchObject({ type: "instance", props: { componentId: PUBLIC_ID, version: 1 } });
  void pageId;

  // T3.6.4/ED-153: instance terpilih → Inspector menampilkan form props (dari propsSchema); ubah → setProp ke doc.
  const titleInput = page.getByTestId("inspector").getByTestId("instance-prop-title");
  await expect(titleInput).toBeVisible();
  await titleInput.fill("Changed");
  await titleInput.blur();
  await expect.poll(async () => (await doc(page)).nodes[selected]?.props?.propValues?.title).toBe("Changed");
});
