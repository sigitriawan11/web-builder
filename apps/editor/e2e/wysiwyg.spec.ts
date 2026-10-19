import { expect, type Page, test } from "@playwright/test";

// Viewport tetap: lebar cukup untuk frame base (1440) di zoom 1; tinggi dipakai sebagai acuan unit `vh` kedua sisi.
test.use({ viewport: { width: 1600, height: 900 } });

// T2.19.2 / ED-240: paritas WYSIWYG — yang terlihat di canvas editor == output publish statis. Untuk 10 fixture × 3
// breakpoint: render editor (canvas, inline style editor-style.ts) vs publish (harness `?harness=wysiwyg`, renderer
// statis) pada lebar frame yang sama, lalu bandingkan geometri tiap node (relatif ke page) dan computed style kunci.
// Deterministik (bukan diff piksel): tidak bergantung antialias/OS; kedua sisi di browser sama → font sama.

// Fixture harus terdaftar di `dev-fixture.ts` (editor) & dibangun fungsi yang sama di harness (fixtureFromSearch).
const FIXTURES = [
  "hero",
  "nested",
  "freeform",
  "autolayout",
  "wrap100",
  "styled",
  "richText",
  "responsive10",
  "landing200",
  "pages2",
] as const;
const BREAKPOINTS = ["base", "tablet", "mobile"] as const;

// Properti yang menentukan tampilan node (layout box + paint). Computed style dinormalkan browser (px/rgb) → cocok
// byte-identik bila CSS editor & publish setara.
const STYLE_PROPS = [
  "display",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "align-self",
  "gap",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "color",
  "background-color",
  "border-top-width",
  "border-top-style",
  "border-top-color",
  "border-top-left-radius",
  "border-top-right-radius",
] as const;

interface NodeBox {
  left: number;
  top: number;
  width: number;
  height: number;
  styles: Record<string, string>;
}

// Kumpulkan geometri (relatif ke page node) + computed style tiap `[data-node-id]` di sebuah root (shadow/iframe doc).
async function collect(page: Page, args: { fromShadow: boolean; pageId: string }): Promise<Record<string, NodeBox>> {
  return page.evaluate(
    ({ fromShadow, pageId, props }) => {
      const root: ParentNode | null = fromShadow
        ? (document.getElementById("world")?.shadowRoot ?? null)
        : (document.querySelector<HTMLIFrameElement>('[data-testid="wys-publish"]')?.contentDocument ?? null);
      if (!root) throw new Error("root render tidak ditemukan");
      const pageEl = root.querySelector(`[data-node-id="${pageId}"]`);
      if (!pageEl) throw new Error(`page node ${pageId} tidak ada`);
      const base = pageEl.getBoundingClientRect();
      const out: Record<string, NodeBox> = {};
      for (const element of root.querySelectorAll("[data-node-id]")) {
        const id = element.getAttribute("data-node-id");
        if (!id) continue;
        const rect = element.getBoundingClientRect();
        const cs = getComputedStyle(element);
        const styles: Record<string, string> = {};
        for (const prop of props) styles[prop] = cs.getPropertyValue(prop);
        out[id] = {
          left: Math.round((rect.left - base.left) * 100) / 100,
          top: Math.round((rect.top - base.top) * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          height: Math.round(rect.height * 100) / 100,
          styles,
        };
      }
      return out;
    },
    { fromShadow: args.fromShadow, pageId: args.pageId, props: [...STYLE_PROPS] },
  );
}

const TOL = 1; // px: toleransi sub-piksel antar root (shadow vs iframe). Paritas layout harus di bawah ini.

for (const fixture of FIXTURES) {
  for (const breakpoint of BREAKPOINTS) {
    test(`WYSIWYG ${fixture} @ ${breakpoint}: canvas editor == publish statis`, async ({ page, context }) => {
      // BUG DM/renderer (T2.19.2a): node `width:fill` (mobile) yang menimpa `width:fixed` (base) di parent yang
      // berubah row→column menghitung lebar salah di publish (mem-bake px lebar containing block desktop, mis.
      // "Kartu 1" landing200 jadi 1232px alih-alih stretch 326px seperti di canvas). test.fail = repro hidup; hapus
      // saat bug diperbaiki (Playwright akan menandai bila mulai lulus). Lihat Lampiran D / ROADMAP T2.19.2a.
      if (fixture === "landing200" && breakpoint === "mobile") {
        test.fail(true, "renderer: fill(mobile) override fixed(base) salah hitung lebar — T2.19.2a");
      }
      // Editor: frame tunggal breakpoint di origin (fokus), zoom 1.
      await page.goto(`?fixture=${fixture}&bp=${breakpoint}&zoom=1&x=0&y=0`);
      await page.waitForFunction(
        () => (document.getElementById("world")?.shadowRoot?.querySelectorAll("[data-node-id]").length ?? 0) > 0,
      );
      const pageId = (
        await page.evaluate(() => (window as unknown as { __spike: { pages(): string[] } }).__spike.pages())
      )[0];
      if (!pageId) throw new Error("pageId tidak ada");
      const pageWidth = await page.evaluate((id) => {
        const el = document.getElementById("world")?.shadowRoot?.querySelector(`[data-node-id="${id}"]`);
        return el ? Math.round(el.getBoundingClientRect().width) : 0;
      }, pageId);
      // Tinggi viewport editor = acuan `vh`; harness memakai nilai sama agar unit viewport resolve identik.
      const viewportHeight = await page.evaluate(() => window.innerHeight);
      const editor = await collect(page, { fromShadow: true, pageId });

      // Publish: iframe harness dengan lebar = lebar frame editor → media query resolve ke breakpoint sama.
      const harness = await context.newPage();
      await harness.setViewportSize({ width: 1600, height: viewportHeight });
      await harness.goto(`?harness=wysiwyg&fixture=${fixture}&bp=${breakpoint}&w=${pageWidth}&h=${viewportHeight}`);
      await harness.waitForFunction(() => {
        const doc = document.querySelector<HTMLIFrameElement>('[data-testid="wys-publish"]')?.contentDocument;
        return !!doc?.querySelector("[data-node-id]");
      });
      const publish = await collect(harness, { fromShadow: false, pageId });
      await harness.close();

      // Setiap node yang ada di kedua sisi harus setara geometri & style. (Node visible:false hanya ada di editor.)
      const shared = Object.keys(editor).filter((id) => id in publish);
      expect(shared.length).toBeGreaterThan(0);
      const geomDiffs: string[] = [];
      const styleDiffs: string[] = [];
      for (const id of shared) {
        const e = editor[id];
        const p = publish[id];
        if (!e || !p) continue;
        // Geometri horizontal (kiri, lebar): kebal terhadap unit `vh` & gambar yang kolaps vertikal saat aset belum
        // dimuat (artefak harness, bukan bug publish). Penyebab beda tinggi (padding/border/font/display) tetap
        // tertangkap lewat computed style di bawah. Paritas tinggi piksel = equivalence.test + preview manual.
        if (Math.abs(e.left - p.left) > TOL || Math.abs(e.width - p.width) > TOL) {
          geomDiffs.push(`${id}: editor(left ${e.left}, w ${e.width}) vs publish(left ${p.left}, w ${p.width})`);
        }
        for (const prop of STYLE_PROPS) {
          if (e.styles[prop] !== p.styles[prop]) {
            styleDiffs.push(`${id} ${prop}: editor "${e.styles[prop]}" vs publish "${p.styles[prop]}"`);
          }
        }
      }
      expect(geomDiffs, `Geometri berbeda:\n${geomDiffs.join("\n")}`).toEqual([]);
      expect(styleDiffs, `Computed style berbeda:\n${styleDiffs.join("\n")}`).toEqual([]);
    });
  }
}
