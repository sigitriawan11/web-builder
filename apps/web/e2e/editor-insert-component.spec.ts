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
const fillSize = (h: number) => ({ width: { mode: "fill" }, height: { mode: "fixed", value: h, unit: "px" } });
const rootNodes = {
  n_root0001: {
    id: "n_root0001",
    type: "frame",
    name: "Root",
    parentId: null,
    visible: true,
    locked: false,
    tag: "div",
    // Dua child (vertikal) → geometri nyata (T3.6.2) + target double-click child (T3.6.3).
    children: ["n_label0001", "n_lockrow0001"],
    style: {
      base: {
        layout: { mode: "flex", direction: "column" },
        size: { width: { mode: "fill" }, height: { mode: "hug" } },
      },
    },
    props: {},
  },
  n_label0001: {
    id: "n_label0001",
    type: "text",
    name: "Label",
    parentId: "n_root0001",
    visible: true,
    locked: false,
    tag: "p",
    style: { base: { size: fillSize(40) } },
    props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Label" }] }] } },
  },
  n_lockrow0001: {
    id: "n_lockrow0001",
    type: "frame",
    name: "Locked",
    parentId: "n_root0001",
    visible: true,
    locked: false,
    tag: "div",
    children: [],
    style: { base: { size: fillSize(40), fills: [{ type: "solid", color: "#eeeeee" }] } },
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
  // DM-079: n_lockrow0001 terkunci penuh → tak bisa di-override (T3.6.3).
  nodeAccess: { n_lockrow0001: { hardLocked: true } },
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
  children?: string[];
  props?: {
    componentId?: string;
    version?: number;
    propValues?: Record<string, unknown>;
    variant?: Record<string, string>;
    overrides?: Record<string, { visible?: boolean; props?: { content?: unknown } }>;
  };
}
const doc = (page: Page) => page.evaluate(() => window.__editorTestApi?.getDoc() as { nodes: Record<string, DNode> });

async function seedComponent(
  client: pg.Client,
  categoryId: string,
  publicId: string,
  name: string,
  definition: unknown,
): Promise<string> {
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
  return versionId;
}

test.beforeAll(async () => {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    // Idempoten (retry Playwright menjalankan ulang beforeAll pada DB yang sama): buang seed sebelumnya dulu.
    await client.query("update components set latest_version_id = null where public_id = any($1)", [
      [PUBLIC_ID, SWAP_ID],
    ]);
    await client.query(
      "delete from component_versions where component_id in (select id from components where public_id = any($1))",
      [[PUBLIC_ID, SWAP_ID]],
    );
    await client.query("delete from components where public_id = any($1)", [[PUBLIC_ID, SWAP_ID]]);
    const categoryId = uuidv7();
    await client.query(
      `insert into library_categories (id, slug, scope, type, name) values ($1,$2,'component','functional',$3)
       on conflict do nothing`,
      [categoryId, `insdemo-cat-${categoryId}`, JSON.stringify({ id: "Demo", en: "Demo" })],
    );
    // Dua component kategori sama → T3.6.6 swap (InsertDemo → InsertDemoB).
    const versionId = await seedComponent(client, categoryId, PUBLIC_ID, "InsertDemo", DEFINITION);
    await seedComponent(client, categoryId, SWAP_ID, "InsertDemoB", SWAP_DEFINITION);
    // T3.7.3/CMP-014: thumbnail base utk PUBLIC_ID (key saja; presign tak butuh objek nyata) → panel tampilkan <img>.
    await client.query(
      `insert into component_version_thumbnails (id, component_version_id, breakpoint, asset_key, width, height)
       values ($1,$2,'base',$3,1440,320)`,
      [uuidv7(), versionId, `thumbnails/components/${versionId}/base.png`],
    );
  } finally {
    await client.end();
  }
});

test("T3.6.1/4/5/6/7/8: insert instance → edit prop/variant → reset → swap → detach", async ({ page }) => {
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

  // T3.6.7/ED-155: indikator ● override (prop & axis) + "Reset semua override" → instance kembali ke default.
  const inspector = page.getByTestId("inspector");
  await expect(inspector.getByTestId("instance-override-title")).toBeVisible();
  await expect(inspector.getByTestId("instance-override-axis-tone")).toBeVisible();
  await inspector.getByTestId("instance-reset-all").click();
  await expect.poll(async () => (await doc(page)).nodes[selected]?.props?.propValues?.title).toBeUndefined();
  await expect.poll(async () => (await doc(page)).nodes[selected]?.props?.variant?.tone).toBeUndefined();
  await expect(inspector.getByTestId("instance-override-title")).toBeHidden();

  // Set ulang (title + tone) agar langkah swap punya nilai untuk dibawa.
  await titleInput.fill("Changed");
  await titleInput.blur();
  await expect.poll(async () => (await doc(page)).nodes[selected]?.props?.propValues?.title).toBe("Changed");
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

test("T3.6.2/ED-170: drag component dari panel → smart insert antara dua instance", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Drag Insert Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.evaluate(() => window.__editorTestApi?.setCamera({ x: 0, y: 0, zoom: 1 }));
  const pageId = await firstPageId(page);

  await page.getByTestId("left-tab-insert").click();
  const button = page.getByTestId("components-panel").getByTestId(`insert-component-${PUBLIC_ID}`);
  await expect(button).toBeVisible();

  // Dua instance disisipkan via klik (append ke page) → tersusun vertikal di page (flex column).
  await button.click();
  await button.click();
  await expect.poll(async () => (await doc(page)).nodes[pageId]?.children?.length ?? 0).toBe(2);
  const before = (await doc(page)).nodes[pageId]?.children ?? [];
  const [first, second] = before;

  // Titik drop = dekat tepi ATAS instance kedua (dalam pita tepi) → bubble ke page, indeks 1 (antara keduanya).
  const canvas = await page.getByTestId("editor-canvas").boundingBox();
  if (!canvas) throw new Error("canvas tidak terlihat");
  const geo = await page.evaluate((id) => window.__editorTestApi?.getGeometry(id) ?? null, second as string);
  if (!geo) throw new Error("geometri instance kedua tidak ada");
  const dropX = canvas.x + geo.x + geo.width / 2;
  const dropY = canvas.y + geo.y + 4;

  const btnBox = await button.boundingBox();
  if (!btnBox) throw new Error("tombol panel tidak terlihat");
  await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(dropX, dropY, { steps: 12 });
  // Ghost + penanda sisip (horizontal, antar section/instance) tampil selama drag.
  await expect(page.locator(".overlay-reorder-ghost")).toBeVisible();
  await expect(page.locator(".overlay-insertion-marker")).toBeVisible();
  await page.mouse.up();

  // Instance baru mendarat di indeks 1 (antara `first` dan `second`).
  await expect.poll(async () => (await doc(page)).nodes[pageId]?.children?.length ?? 0).toBe(3);
  const after = (await doc(page)).nodes[pageId]?.children ?? [];
  expect(after[0]).toBe(first);
  expect(after[2]).toBe(second);
  expect(after[1]).not.toBe(first);
  expect(after[1]).not.toBe(second);
  expect((await doc(page)).nodes[after[1] as string]?.type).toBe("instance");
});

test("T3.7.3/CMP-014: panel Components menampilkan thumbnail (base) component", async ({ page }) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Thumb Panel Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  await page.getByTestId("left-tab-insert").click();
  const thumb = page.getByTestId("components-panel").getByTestId(`component-thumb-${PUBLIC_ID}`);
  await expect(thumb).toBeVisible();
  // src = URL presigned thumbnail base (key dari component_version_thumbnails).
  const src = await thumb.getAttribute("src");
  expect(src ?? "").toContain(`thumbnails/components/`);
});

test("T3.6.3/ED-058: double-click masuk ke child instance → override teks & visibility; hardLocked tak bisa diubah", async ({
  page,
}) => {
  await page.goto(`${APP_URL}/sites`);
  await page.goto(`${APP_URL}/editor/${await createSiteViaApi(page, "Child Override Test")}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  await page.getByTestId("left-tab-insert").click();
  await page.getByTestId("components-panel").getByTestId(`insert-component-${PUBLIC_ID}`).click();
  const instId = (await page.evaluate(() => window.__editorTestApi?.getSelection() ?? []))[0] as string;
  const inspector = page.getByTestId("inspector");

  // Double-click child teks (resolved id `${instId}:n_label0001`) → masuk mode override; Inspector tampilkan kontrol.
  await page.locator(`[data-resolved-id="${instId}:n_label0001"]`).dblclick();
  const textInput = inspector.getByTestId("instance-child-text");
  await expect(textInput).toBeVisible();

  // Override teks → props.overrides[n_label0001].props.content tertulis.
  await textInput.fill("Halo");
  await textInput.blur();
  await expect
    .poll(async () => {
      const content = (await doc(page)).nodes[instId]?.props?.overrides?.n_label0001?.props?.content;
      return JSON.stringify(content ?? "");
    })
    .toContain("Halo");

  // Override visibility → overrides[n_label0001].visible === false.
  await inspector.getByTestId("instance-child-visible").click();
  await expect.poll(async () => (await doc(page)).nodes[instId]?.props?.overrides?.n_label0001?.visible).toBe(false);

  // Child hardLocked (n_lockrow0001) → masuk mode tapi tak ada kontrol (pesan terkunci).
  await page.locator(`[data-resolved-id="${instId}:n_lockrow0001"]`).dblclick();
  await expect(inspector.getByTestId("instance-child-locked")).toBeVisible();
  await expect(inspector.getByTestId("instance-child-visible")).toBeHidden();

  // Klik tunggal di area kosong canvas → keluar mode child (kembali ke props instance / tak ada override UI).
  const canvas = await page.getByTestId("editor-canvas").boundingBox();
  if (!canvas) throw new Error("canvas tidak terlihat");
  await page.mouse.click(canvas.x + canvas.width - 12, canvas.y + canvas.height - 12);
  await expect(inspector.getByTestId("instance-child-text")).toBeHidden();
  await expect(inspector.getByTestId("instance-child-locked")).toBeHidden();
});
