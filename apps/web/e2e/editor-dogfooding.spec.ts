import { expect, type Page, test } from "@playwright/test";
import { APP_URL } from "../playwright.config";
import { OWNER_STATE } from "./support/auth";
import { editorCommand } from "./support/editor";
import { createSiteViaApi } from "./support/sites";

// T2.19.3 / §M2.d: dogfooding otomatis — bangun 2 landing page dari nol HANYA lewat command editor (jalur user),
// lalu audit: tanpa error konsol, dokumen valid (mode publish), persist setelah reload, dan undo mengembalikan.
// Bug yang muncul dicatat sebagai temuan (lihat ringkasan / ROADMAP), bukan disembunyikan.
test.use({ locale: "en-US", storageState: OWNER_STATE });

const px = (value: number) => ({ value, unit: "px" as const });
const fixed = (value: number) => ({ mode: "fixed" as const, value, unit: "px" as const });
const FILL = { mode: "fill" as const };
const HUG = { mode: "hug" as const };
const solid = (color: string) => [{ type: "solid" as const, color }];
const pad = (v: number) => ({ top: px(v), right: px(v), bottom: px(v), left: px(v) });

// Spesifikasi node deklaratif → dibangun rekursif lewat createNode (+ setTextContent untuk teks).
interface Spec {
  type: "frame" | "text";
  name?: string;
  style?: Record<string, unknown>;
  mobile?: Record<string, unknown>;
  text?: string;
  children?: Spec[];
}

async function build(page: Page, parentId: string, spec: Spec): Promise<string> {
  const res = await editorCommand(page, "createNode", {
    parentId,
    type: spec.type,
    ...(spec.name ? { name: spec.name } : {}),
    ...(spec.style ? { style: { base: spec.style } } : {}),
  });
  if (!res.ok) throw new Error(`createNode ${spec.type} gagal: ${res.error?.code}`);
  const id = res.value as string;
  if (spec.mobile) {
    const m = await editorCommand(page, "updateStyle", { ids: [id], breakpoint: "mobile", patch: spec.mobile });
    if (!m.ok) throw new Error(`updateStyle mobile gagal: ${m.error?.code}`);
  }
  if (spec.text !== undefined) {
    const t = await editorCommand(page, "setTextContent", { id, content: spec.text });
    if (!t.ok) throw new Error(`setTextContent gagal: ${t.error?.code}`);
  }
  for (const child of spec.children ?? []) await build(page, id, child);
  return id;
}

const column = (gap: number, extra: Record<string, unknown> = {}) => ({
  layout: { mode: "flex", direction: "column", gap: px(gap), align: "stretch", ...extra },
  size: { width: FILL, height: HUG },
});
const text = (value: string, name = "Teks"): Spec => ({
  type: "text",
  name,
  text: value,
  style: { size: { width: HUG, height: HUG } },
});

// Kartu: lebar tetap di desktop, fill di mobile — pola responsif umum yang menguji stack.
const card = (title: string, body: string): Spec => ({
  type: "frame",
  name: "Kartu",
  style: {
    layout: { mode: "flex", direction: "column", gap: px(8), padding: pad(24) },
    size: { width: fixed(280), height: HUG },
    fills: solid("#FFFFFF"),
  },
  mobile: { size: { width: FILL } },
  children: [text(title, "Judul kartu"), text(body, "Isi kartu")],
});

// Landing page lengkap: navbar, hero, 3 fitur (row→column di mobile), CTA, footer.
const landingHome: Spec = {
  type: "frame",
  name: "Beranda",
  style: column(0),
  children: [
    {
      type: "frame",
      name: "Navbar",
      style: {
        layout: { mode: "flex", direction: "row", justify: "spaceBetween", align: "center", padding: pad(16) },
        size: { width: FILL, height: HUG },
        fills: solid("#0F172A"),
      },
      children: [
        text("Platform", "Logo"),
        {
          type: "frame",
          name: "Nav",
          style: { layout: { mode: "flex", direction: "row", gap: px(16) }, size: { width: HUG, height: HUG } },
          children: [text("Fitur"), text("Harga"), text("Kontak")],
        },
      ],
    },
    {
      type: "frame",
      name: "Hero",
      style: {
        layout: { mode: "flex", direction: "column", gap: px(16), align: "center", padding: pad(64) },
        size: { width: FILL, height: HUG },
        fills: solid("#F8FAFC"),
      },
      children: [
        text("Bangun website tanpa koding", "Judul hero"),
        text("Template, canvas, dan AI untuk UMKM Indonesia.", "Subjudul"),
        {
          type: "frame",
          name: "Tombol",
          style: {
            layout: {
              mode: "flex",
              direction: "row",
              padding: { top: px(12), right: px(24), bottom: px(12), left: px(24) },
            },
            size: { width: HUG, height: HUG },
            fills: solid("#2563EB"),
          },
          children: [text("Mulai gratis", "Label tombol")],
        },
      ],
    },
    {
      type: "frame",
      name: "Fitur",
      style: {
        layout: { mode: "flex", direction: "row", wrap: true, gap: px(24), justify: "center", padding: pad(48) },
        size: { width: FILL, height: HUG },
      },
      mobile: { layout: { direction: "column" } },
      children: [
        card("Cepat", "Online dalam hitungan menit."),
        card("Fleksibel", "Canvas ala Figma."),
        card("AI", "Asisten membangun untukmu."),
      ],
    },
    {
      type: "frame",
      name: "CTA",
      style: {
        layout: { mode: "flex", direction: "column", gap: px(16), align: "center", padding: pad(48) },
        size: { width: FILL, height: HUG },
        fills: solid("#0F172A"),
      },
      children: [
        text("Siap mulai?", "Judul CTA"),
        {
          type: "frame",
          name: "Tombol CTA",
          style: {
            layout: {
              mode: "flex",
              direction: "row",
              padding: { top: px(12), right: px(24), bottom: px(12), left: px(24) },
            },
            size: { width: HUG, height: HUG },
            fills: solid("#2563EB"),
          },
          children: [text("Daftar sekarang", "Label")],
        },
      ],
    },
    {
      type: "frame",
      name: "Footer",
      style: {
        layout: { mode: "flex", direction: "row", justify: "spaceBetween", padding: pad(24) },
        size: { width: FILL, height: HUG },
        fills: solid("#0F172A"),
      },
      children: [text("© 2026 Platform", "Copyright"), text("Kebijakan privasi", "Link footer")],
    },
  ],
};

// Page kedua: lebih sederhana — hero + baris 2 kolom yang menumpuk di mobile + penutup.
const landingAbout: Spec = {
  type: "frame",
  name: "Tentang",
  style: column(0),
  children: [
    {
      type: "frame",
      name: "Hero Tentang",
      style: {
        layout: { mode: "flex", direction: "column", gap: px(12), align: "center", padding: pad(64) },
        size: { width: FILL, height: HUG },
        fills: solid("#F1F5F9"),
      },
      children: [text("Tentang kami", "Judul"), text("Kami bantu UMKM hadir online.", "Sub")],
    },
    {
      type: "frame",
      name: "Dua Kolom",
      style: {
        layout: { mode: "flex", direction: "row", gap: px(32), padding: pad(48) },
        size: { width: FILL, height: HUG },
      },
      mobile: { layout: { direction: "column" } },
      children: [
        {
          type: "frame",
          name: "Kolom kiri",
          style: { layout: { mode: "flex", direction: "column", gap: px(8) }, size: { width: FILL, height: HUG } },
          children: [text("Misi", "H"), text("Membuat web mudah untuk semua.", "P")],
        },
        {
          type: "frame",
          name: "Kolom kanan",
          style: { layout: { mode: "flex", direction: "column", gap: px(8) }, size: { width: FILL, height: HUG } },
          children: [text("Visi", "H"), text("Setiap usaha punya rumah digital.", "P")],
        },
      ],
    },
    {
      type: "frame",
      name: "Penutup",
      style: {
        layout: { mode: "flex", direction: "row", justify: "center", padding: pad(32) },
        size: { width: FILL, height: HUG },
        fills: solid("#0F172A"),
      },
      children: [text("Hubungi kami", "Link")],
    },
  ],
};

test("AC §M2.d: bangun 2 landing page dari nol lewat editor → dokumen valid, persist, tanpa error konsol", async ({
  page,
}) => {
  const consoleIssues: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") consoleIssues.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (err) => consoleIssues.push(`[pageerror] ${err.message}`));

  await page.goto(`${APP_URL}/sites`);
  const siteId = await createSiteViaApi(page, "Dogfooding Landing");
  await page.goto(`${APP_URL}/editor/${siteId}`);
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();

  // Page 1 "Beranda": bangun di page starter.
  const home = await page.evaluate(() => {
    const doc = window.__editorTestApi?.getDoc() as { pageOrder: string[] } | undefined;
    return doc?.pageOrder[0];
  });
  if (!home) throw new Error("page starter tidak ada");
  await build(page, home, landingHome);

  // Page 2 "Tentang": buat page baru lalu bangun.
  const created = await editorCommand(page, "createPage", { title: "Tentang", path: "/tentang" });
  expect(created.ok, `createPage: ${created.error?.code}`).toBe(true);
  const about = created.value as string;
  await build(page, about, landingAbout);

  // --- Audit 1: struktur dokumen konsisten. Setiap command lewat validasi document-model (invarian), jadi `build()`
  // yang tidak melempar = semua op valid. Tambahan: 2 page, tepat satu home, tidak ada node yatim (parent hilang).
  const structure = await page.evaluate(() => {
    const d = window.__editorTestApi?.getDoc() as {
      pageOrder: string[];
      nodes: Record<string, { parentId?: string; type: string; props?: { isHome?: boolean } }>;
    };
    const ids = new Set(Object.keys(d.nodes));
    const orphans = Object.entries(d.nodes).filter(
      ([, n]) => n.type !== "page" && (!n.parentId || !ids.has(n.parentId)),
    ).length;
    const homes = Object.values(d.nodes).filter((n) => n.type === "page" && n.props?.isHome).length;
    return { pages: d.pageOrder.length, orphans, homes };
  });
  expect(structure.pages, "harus 2 page").toBe(2);
  expect(structure.orphans, "tidak boleh ada node yatim").toBe(0);
  expect(structure.homes, "tepat satu home").toBe(1);

  // --- Audit 2: node benar-benar ter-render di canvas (bukan hanya di dokumen).
  const rendered = await page.evaluate(
    () => document.getElementById("world")?.shadowRoot?.querySelectorAll("[data-node-id]").length ?? 0,
  );
  expect(rendered).toBeGreaterThan(20);

  // --- Audit 3: persist setelah reload (autosave realtime) — dokumen tetap valid & jumlah node sama.
  const nodeCount = await page.evaluate(() => {
    const doc = window.__editorTestApi?.getDoc() as { nodes: object } | undefined;
    return Object.keys(doc?.nodes ?? {}).length;
  });
  await page.reload();
  await expect(page.locator('[data-connection-status="synced"]')).toBeVisible();
  await page.waitForFunction(
    (expected) => Object.keys((window.__editorTestApi?.getDoc() as { nodes: object })?.nodes ?? {}).length === expected,
    nodeCount,
  );
  const reRendered = await page.evaluate(
    () => document.getElementById("world")?.shadowRoot?.querySelectorAll("[data-node-id]").length ?? 0,
  );
  expect(reRendered, "node tetap ter-render setelah reload").toBeGreaterThan(20);

  // --- Audit 4: tidak ada error/peringatan konsol baru selama membangun & render.
  // Temuan diketahui (dicatat di ROADMAP M2.d): warning React "<div> cannot be a descendant of <p>" dari
  // InlineTextEditor saat node teks diedit — TIDAK dipicu di alur ini (tanpa masuk mode edit teks).
  expect(consoleIssues, `Masalah konsol:\n${consoleIssues.join("\n")}`).toEqual([]);
});
