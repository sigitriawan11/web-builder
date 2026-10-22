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
const SWAP_ID = "cmp_insdemo02";
const rootNodes = {
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
};
const DEFINITION = {
  schemaVersion: 1,
  id: PUBLIC_ID,
  version: 1,
  name: "InsertDemo",
  category: "card",
  // `title` punya semanticRole "heading" → terbawa saat swap walau key tujuan berbeda.
  propsSchema: [
    { key: "title", label: { id: "Judul", en: "Title" }, type: "text", default: "Hello", semanticRole: "heading" },
  ],
  variantAxes: [{ name: "tone", options: ["solid", "outline"], default: "solid" }],
  rootId: "n_root0001",
  nodes: rootNodes,
};
// Target swap: kategori sama; prop `headingText` dgn semanticRole "heading" → menerima nilai `title`.
const SWAP_DEFINITION = {
  schemaVersion: 1,
  id: SWAP_ID,
  version: 1,
  name: "InsertDemoB",
  category: "card",
  propsSchema: [{ key: "headingText", label: { id: "Judul", en: "Heading" }, type: "text", semanticRole: "heading" }],
  variantAxes: [{ name: "tone", options: ["solid", "outline"], default: "solid" }],
  rootId: "n_root0001",
  nodes: rootNodes,
};

interface DNode {
  type: string;
  props?: {
    componentId?: string;
    version?: number;
    propValues?: Record<string, unknown>;
    variant?: Record<string, string>;
  };
}
const doc = (page: Page) => page.evaluate(() => window.__editorTestApi?.getDoc() as { nodes: Record<string, DNode> });

async function seedComponent(
  client: pg.Client,
  categoryId: string,
  publicId: string,
  name: string,
  definition: unknown,
) {
  const componentId = uuidv7();
  const versionId = uuidv7();
  await client.query(
    `insert into components (id, public_id, slug, owner_type, kind, category_id, name, display_name, description, status, latest_version, latest_version_id)
     values ($1,$2,$3,'platform','section',$4,$5,$6,$7,'published','1.0.0',$8)`,
    [
      componentId,
      publicId,
      `${name}-${componentId}`,
      categoryId,
      name,
      JSON.stringify({ id: name, en: name }),
      JSON.stringify({ id: "d", en: "d" }),
      versionId,
    ],
  );
  // content_hash null → endpoint read lewati verifikasi integritas (CMP-044); test ini hanya cek penyisipan instance.
  await client.query(
    `insert into component_versions (id, component_id, version, version_seq, status, definition, changelog)
     values ($1,$2,'1.0.0',1,'published',$3,$4)`,
    [versionId, componentId, JSON.stringify(definition), JSON.stringify({ id: "r", en: "r" })],
  );
}

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
    // Dua component kategori sama → T3.6.6 swap (InsertDemo → InsertDemoB).
    await seedComponent(client, categoryId, PUBLIC_ID, "InsertDemo", DEFINITION);
    await seedComponent(client, categoryId, SWAP_ID, "InsertDemoB", SWAP_DEFINITION);
  } finally {
    await client.end();
  }
});

test("T3.6.1/4/5/6/8: insert instance → edit prop/variant → swap → detach", async ({ page }) => {
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

  // T3.6.5/CMP-031: variant picker — ganti axis `tone` → `setVariant` ke doc.
  const toneSelect = page.getByTestId("inspector").getByTestId("instance-variant-tone");
  await expect(toneSelect).toBeVisible();
  await toneSelect.selectOption("outline");
  await expect.poll(async () => (await doc(page)).nodes[selected]?.props?.variant?.tone).toBe("outline");

  // T3.6.6/CMP-074: swap ke component kategori sama → componentId berganti; `title` (semanticRole heading) terbawa
  // ke `headingText` component tujuan; variant `tone` tetap (opsi valid).
  const swapSelect = page.getByTestId("inspector").getByTestId("instance-swap");
  await expect(swapSelect).toBeVisible();
  await swapSelect.selectOption(SWAP_ID);
  await expect.poll(async () => (await doc(page)).nodes[selected]?.props?.componentId).toBe(SWAP_ID);
  expect((await doc(page)).nodes[selected]?.props?.propValues?.headingText).toBe("Changed");
  expect((await doc(page)).nodes[selected]?.props?.variant?.tone).toBe("outline");

  // T3.6.8/CMP-057: detach — instance jadi node biasa; node instance hilang dari doc.
  await page.getByTestId("inspector").getByTestId("instance-detach").click();
  await expect(page.getByTestId("inspector").getByTestId("instance-detach")).toBeHidden();
  await expect.poll(async () => Object.values((await doc(page)).nodes).some((n) => n.type === "instance")).toBe(false);
});
