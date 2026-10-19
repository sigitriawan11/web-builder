import type { SiteDocument } from "../../src";
import { defaultTheme } from "../../src/defaults/theme";
import { defaultSiteSettings } from "../../src/defaults/top-level";

// DM-004 AC: dokumen kosong minimal (1 page tanpa child) harus valid.
export function minimalDocument(): SiteDocument {
  return {
    schemaVersion: 7,
    meta: { title: "Situs Kosong", createdWith: "blank" },
    settings: defaultSiteSettings({ title: "Situs Kosong" }),
    theme: defaultTheme(),
    componentDeps: {},
    assets: {},
    pageOrder: ["pg_home000001"],
    nodes: {
      pg_home000001: {
        id: "pg_home000001",
        type: "page",
        name: "Home",
        parentId: null,
        children: [],
        visible: true,
        locked: false,
        style: { base: { layout: { mode: "flex", direction: "column" }, size: { width: { mode: "fill" } } } },
        props: { path: "/", title: "Home", isHome: true },
      },
    },
  };
}

// Landing kecil berdasarkan contoh spec 01 (DM-010, DM-011, DM-013, DM-014, DM-036).
export function heroDocument(): SiteDocument {
  return {
    schemaVersion: 7,
    meta: { title: "Toko Kue Budi", createdWith: "template" },
    settings: defaultSiteSettings({ title: "Toko Kue Budi" }),
    theme: defaultTheme(),
    componentDeps: {},
    assets: {
      ast_cake000001: { kind: "image", width: 1600, height: 1067, mime: "image/jpeg" },
    },
    pageOrder: ["pg_home000001", "pg_about00001"],
    nodes: {
      pg_home000001: {
        id: "pg_home000001",
        type: "page",
        name: "Home",
        parentId: null,
        children: ["n_hero000001"],
        visible: true,
        locked: false,
        style: {
          base: {
            layout: { mode: "flex", direction: "column" },
            size: { width: { mode: "fill" } },
            fills: [{ type: "solid", color: { $token: "color.background" } }],
          },
        },
        props: { path: "/", title: "Home", isHome: true, seo: { title: "Beranda" } },
      },
      n_hero000001: {
        id: "n_hero000001",
        type: "frame",
        name: "Hero",
        parentId: "pg_home000001",
        children: ["n_herottl001", "n_heroimg001"],
        visible: true,
        locked: false,
        tag: "section",
        style: {
          base: {
            layout: {
              mode: "flex",
              direction: "column",
              gap: { $token: "space.6" },
              align: "center",
              justify: "center",
              padding: {
                top: { $token: "space.16" },
                right: { $token: "space.8" },
                bottom: { $token: "space.16" },
                left: { $token: "space.8" },
              },
            },
            size: {
              width: { mode: "fill" },
              height: { mode: "hug" },
              minHeight: { value: 560, unit: "px" },
            },
            fills: [{ type: "solid", color: "#FFF8F0" }],
            radius: { topLeft: { value: 24, unit: "px" }, topRight: { value: 24, unit: "px" } },
          },
          mobile: {
            layout: { padding: { top: { $token: "space.10" }, bottom: { $token: "space.10" } } },
            size: { minHeight: { value: 420, unit: "px" } },
          },
        },
        props: { role: "section" },
      },
      n_herottl001: {
        id: "n_herottl001",
        type: "text",
        name: "Hero / Title",
        parentId: "n_hero000001",
        visible: true,
        locked: false,
        tag: "h1",
        style: { base: { size: { width: { mode: "fill" }, height: { mode: "hug" } } } },
        props: {
          autoSize: "height",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                attrs: { align: "center" },
                content: [
                  { type: "text", text: "Kue rumahan, " },
                  { type: "text", text: "fresh setiap hari", marks: [{ type: "bold" }] },
                ],
              },
            ],
          },
        },
      },
      n_heroimg001: {
        id: "n_heroimg001",
        type: "image",
        name: "Hero / Photo",
        parentId: "n_hero000001",
        visible: true,
        locked: false,
        style: {
          base: {
            size: { width: { mode: "fill" }, height: { mode: "fixed", value: 420, unit: "px" } },
            radius: { $token: "radius.lg" },
          },
          mobile: { size: { height: { mode: "fixed", value: 240, unit: "px" } }, radius: null },
        },
        props: {
          fit: "cover",
          image: {
            assetId: "ast_cake000001",
            alt: "Kue cokelat di meja kayu",
            focalPoint: { x: 0.5, y: 0.4 },
          },
        },
      },
      pg_about00001: {
        id: "pg_about00001",
        type: "page",
        name: "Tentang",
        parentId: null,
        children: [],
        visible: true,
        locked: false,
        style: { base: { layout: { mode: "flex", direction: "column" } } },
        props: { path: "/tentang", title: "Tentang Kami" },
      },
    },
  };
}

// Kasus tepi untuk round-trip: nesting 4 level, layout `none`, override tablet + mobile, null di patch,
// heading dengan banyak mark, hardBreak, dan paragraf kosong.
export function nestedDocument(): SiteDocument {
  const frame = (
    id: string,
    parentId: string,
    children: string[],
    style: SiteDocument["nodes"][string]["style"],
  ): SiteDocument["nodes"][string] => ({
    id,
    type: "frame",
    name: `Frame ${id}`,
    parentId,
    children,
    visible: true,
    locked: false,
    style,
    props: {},
  });

  // Token bersarang `color.brand.600` (DM-041) dipakai fill di bawah.
  const theme = defaultTheme();
  theme.tokens.color.brand = { 600: "#9A3412" };

  return {
    schemaVersion: 7,
    meta: { title: "Kasus Tepi" },
    settings: defaultSiteSettings({ title: "Kasus Tepi" }),
    theme,
    componentDeps: {},
    assets: {
      ast_logo000001: { kind: "svg", mime: "image/svg+xml", libraryShared: true },
    },
    pageOrder: ["pg_home000001"],
    nodes: {
      pg_home000001: {
        id: "pg_home000001",
        type: "page",
        name: "Home",
        parentId: null,
        children: ["n_lvl1000001"],
        visible: true,
        locked: false,
        tag: "main",
        style: { base: { layout: { mode: "flex", direction: "column" } } },
        props: { path: "/", title: "Home", isHome: true, seo: { noIndex: true } },
      },
      n_lvl1000001: frame("n_lvl1000001", "pg_home000001", ["n_lvl2000001"], {
        base: {
          layout: { mode: "flex", direction: "row", wrap: true, gap: { value: 2, unit: "rem" } },
          fills: [
            { type: "solid", color: "#00000080", opacity: 0.5 },
            { type: "solid", color: { $token: "color.brand.600", alpha: 0.2 }, visible: false },
          ],
        },
        tablet: { layout: { direction: "column", gap: null } },
        mobile: { fills: null, layout: { padding: { left: { value: 8, unit: "px" } } } },
      }),
      n_lvl2000001: frame("n_lvl2000001", "n_lvl1000001", ["n_lvl3000001"], {
        base: { layout: { mode: "none" }, size: { width: { mode: "fixed", value: 50, unit: "%" } } },
        mobile: { layout: { mode: "flex", direction: "column" }, size: { width: null } },
      }),
      n_lvl3000001: frame("n_lvl3000001", "n_lvl2000001", ["n_lvl4text001", "n_lvl4img0001"], {
        base: { radius: { value: 4, unit: "px" }, size: { aspectRatio: 1.7778 } },
      }),
      n_lvl4text001: {
        id: "n_lvl4text001",
        type: "text",
        name: "Judul",
        parentId: "n_lvl3000001",
        visible: false,
        locked: true,
        tag: "h2",
        style: { base: {} },
        props: {
          truncate: { lines: 2 },
          content: {
            type: "doc",
            content: [
              {
                type: "heading",
                attrs: { level: 2, align: "right" },
                content: [
                  { type: "text", text: "Satu", marks: [{ type: "bold" }, { type: "italic" }] },
                  { type: "hardBreak" },
                  { type: "text", text: "Dua", marks: [{ type: "underline" }, { type: "strike" }] },
                ],
              },
              { type: "paragraph" },
            ],
          },
        },
      },
      n_lvl4img0001: {
        id: "n_lvl4img0001",
        type: "image",
        name: "Logo",
        parentId: "n_lvl3000001",
        visible: true,
        locked: false,
        style: { base: { size: { width: { mode: "fixed", value: 120, unit: "px" } } } },
        props: { fit: "contain", decorative: true, loading: "eager", image: { assetId: "ast_logo000001" } },
      },
    },
  };
}

// Papan freeform (layout none) berisi node absolute (DM-011, DM-028) untuk drag move (T0.6.2).
export function freeformDocument(): SiteDocument {
  const fixed = (value: number) => ({ mode: "fixed" as const, value, unit: "px" as const });
  return {
    schemaVersion: 7,
    meta: { title: "Papan Bebas" },
    settings: defaultSiteSettings({ title: "Papan Bebas" }),
    theme: defaultTheme(),
    componentDeps: {},
    assets: { ast_ph0000001: { kind: "image", width: 1200, height: 800, mime: "image/jpeg" } },
    pageOrder: ["pg_home000001"],
    nodes: {
      pg_home000001: {
        id: "pg_home000001",
        type: "page",
        name: "Home",
        parentId: null,
        children: ["n_board00001"],
        visible: true,
        locked: false,
        style: { base: { layout: { mode: "flex", direction: "column" } } },
        props: { path: "/", title: "Home", isHome: true },
      },
      n_board00001: {
        id: "n_board00001",
        type: "frame",
        name: "Papan",
        parentId: "pg_home000001",
        children: ["n_fcard00001", "n_fimage0001", "n_ftext00001"],
        visible: true,
        locked: false,
        tag: "section",
        style: {
          base: {
            layout: { mode: "none" },
            size: { width: { mode: "fill" }, height: fixed(800) },
            fills: [{ type: "solid", color: "#F7F3EE" }],
          },
        },
        props: { role: "section" },
      },
      n_fcard00001: {
        id: "n_fcard00001",
        type: "frame",
        name: "Kartu",
        parentId: "n_board00001",
        children: [],
        visible: true,
        locked: false,
        style: {
          base: {
            position: { type: "absolute", x: 80, y: 80 },
            size: { width: fixed(240), height: fixed(160) },
            fills: [{ type: "solid", color: "#FFE3CC" }],
            radius: { value: 12, unit: "px" },
          },
        },
        props: { role: "card" },
      },
      n_fimage0001: {
        id: "n_fimage0001",
        type: "image",
        name: "Foto",
        parentId: "n_board00001",
        visible: true,
        locked: false,
        style: {
          base: { position: { type: "absolute", x: 420, y: 120 }, size: { width: fixed(320), height: fixed(200) } },
        },
        props: { fit: "cover", image: { assetId: "ast_ph0000001", alt: "Foto produk" } },
      },
      n_ftext00001: {
        id: "n_ftext00001",
        type: "text",
        name: "Catatan",
        parentId: "n_board00001",
        visible: true,
        locked: false,
        tag: "p",
        style: {
          base: { position: { type: "absolute", x: 80, y: 320 }, size: { width: fixed(400), height: { mode: "hug" } } },
        },
        props: {
          content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Seret aku ke mana saja" }] }],
          },
        },
      },
    },
  };
}

// Tiga kombinasi auto-layout (DM-026, DM-027) untuk verifikasi render flexbox (T0.6.4):
// baris (padding, gap, align center, anak fixed/fill/hug), kolom (spaceBetween, stretch), baris wrap (gap & crossGap).
export function autolayoutDocument(): SiteDocument {
  const px = (value: number) => ({ value, unit: "px" as const });
  const fixed = (value: number) => ({ mode: "fixed" as const, value, unit: "px" as const });
  const pad = (value: number) => ({ top: px(value), right: px(value), bottom: px(value), left: px(value) });
  type Node = SiteDocument["nodes"][string];
  const frame = (
    id: string,
    parentId: string,
    name: string,
    children: string[],
    style: Node["style"]["base"],
  ): Node => ({
    id,
    type: "frame",
    name,
    parentId,
    children,
    visible: true,
    locked: false,
    style: { base: style },
    props: {},
  });
  const box = (id: string, parentId: string, color: string, size: NonNullable<Node["style"]["base"]["size"]>): Node =>
    frame(id, parentId, `Kotak ${id}`, [], { size, fills: [{ type: "solid", color }] });
  const text = (
    id: string,
    parentId: string,
    value: string,
    size: NonNullable<Node["style"]["base"]["size"]>,
  ): Node => ({
    id,
    type: "text",
    name: `Teks ${id}`,
    parentId,
    visible: true,
    locked: false,
    tag: "p",
    style: { base: { size } },
    props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] } },
  });

  const wrapItems = ["n_alwrap0a01", "n_alwrap0a02", "n_alwrap0a03", "n_alwrap0a04", "n_alwrap0a05"];
  const nodes: Node[] = [
    {
      id: "pg_home000001",
      type: "page",
      name: "Home",
      parentId: null,
      children: ["n_alrow00001", "n_alcol00001", "n_alwrap0001"],
      visible: true,
      locked: false,
      style: { base: { layout: { mode: "flex", direction: "column", gap: px(40), padding: pad(40), align: "start" } } },
      props: { path: "/", title: "Home", isHome: true },
    },
    frame("n_alrow00001", "pg_home000001", "Baris", ["n_alrowfix01", "n_alrowfil01", "n_alrowhug01"], {
      layout: { mode: "flex", direction: "row", gap: px(16), padding: pad(24), align: "center" },
      size: { width: fixed(800), height: { mode: "hug" } },
      fills: [{ type: "solid", color: "#E8F1FF" }],
    }),
    box("n_alrowfix01", "n_alrow00001", "#0D99FF", { width: fixed(120), height: fixed(80) }),
    box("n_alrowfil01", "n_alrow00001", "#7CC4FF", { width: { mode: "fill" }, height: fixed(40) }),
    text("n_alrowhug01", "n_alrow00001", "Label hug", { width: { mode: "hug" }, height: { mode: "hug" } }),
    frame("n_alcol00001", "pg_home000001", "Kolom", ["n_alcoltxt01", "n_alcolbox01", "n_alcolbox02"], {
      layout: {
        mode: "flex",
        direction: "column",
        gap: px(8),
        padding: pad(16),
        justify: "spaceBetween",
        align: "stretch",
      },
      size: { width: fixed(400), height: fixed(300) },
      fills: [{ type: "solid", color: "#FFF1E6" }],
    }),
    text("n_alcoltxt01", "n_alcol00001", "Judul kolom", { height: { mode: "hug" } }),
    box("n_alcolbox01", "n_alcol00001", "#FF9F5A", { width: { mode: "fill" }, height: fixed(60) }),
    box("n_alcolbox02", "n_alcol00001", "#FFC999", { height: fixed(40) }),
    frame("n_alwrap0001", "pg_home000001", "Wrap", wrapItems, {
      layout: { mode: "flex", direction: "row", wrap: true, gap: px(12), crossGap: px(20), padding: pad(10) },
      size: { width: fixed(360), height: { mode: "hug" } },
      fills: [{ type: "solid", color: "#EAF7EA" }],
    }),
    ...wrapItems.map((id) => box(id, "n_alwrap0001", "#5CB85C", { width: fixed(100), height: fixed(50) })),
  ];

  return {
    schemaVersion: 7,
    meta: { title: "Auto-layout" },
    settings: defaultSiteSettings({ title: "Auto-layout" }),
    theme: defaultTheme(),
    componentDeps: {},
    assets: {},
    pageOrder: ["pg_home000001"],
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
  };
}

// Grid flex-wrap berisi `count` kartu (frame + teks) untuk mengukur fps resize auto-layout (ED-022, T0.6.6).
export function wrapGridDocument(count = 100): SiteDocument {
  const px = (value: number) => ({ value, unit: "px" as const });
  const fixed = (value: number) => ({ mode: "fixed" as const, value, unit: "px" as const });
  type Node = SiteDocument["nodes"][string];
  const pad = (value: number) => ({ top: px(value), right: px(value), bottom: px(value), left: px(value) });
  const cardId = (i: number) => `n_wgcard${String(i).padStart(4, "0")}`;
  const textId = (i: number) => `n_wgtext${String(i).padStart(4, "0")}`;

  const cards: Node[] = Array.from({ length: count }, (_, i) => [
    {
      id: cardId(i),
      type: "frame",
      name: `Kartu ${i + 1}`,
      parentId: "n_wggrid0001",
      children: [textId(i)],
      visible: true,
      locked: false,
      style: {
        base: {
          layout: { mode: "flex", direction: "column", padding: pad(8), justify: "center" },
          size: { width: fixed(140), height: fixed(80) },
          fills: [{ type: "solid", color: i % 2 === 0 ? "#D6E8FF" : "#FFE3CC" }],
          radius: px(8),
        },
      },
      props: { role: "card" },
    } satisfies Node,
    {
      id: textId(i),
      type: "text",
      name: `Kartu ${i + 1} / Label`,
      parentId: cardId(i),
      visible: true,
      locked: false,
      tag: "p",
      style: { base: { size: { width: { mode: "fill" }, height: { mode: "hug" } } } },
      props: {
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: `Item ${i + 1}` }] }] },
      },
    } satisfies Node,
  ]).flat();

  const nodes: Node[] = [
    {
      id: "pg_home000001",
      type: "page",
      name: "Home",
      parentId: null,
      children: ["n_wggrid0001"],
      visible: true,
      locked: false,
      style: { base: { layout: { mode: "flex", direction: "column", padding: pad(40), align: "start" } } },
      props: { path: "/", title: "Home", isHome: true },
    },
    {
      id: "n_wggrid0001",
      type: "frame",
      name: "Grid",
      parentId: "pg_home000001",
      children: Array.from({ length: count }, (_, i) => cardId(i)),
      visible: true,
      locked: false,
      style: {
        base: {
          layout: { mode: "flex", direction: "row", wrap: true, gap: px(12), crossGap: px(12), padding: pad(16) },
          size: { width: fixed(1200), height: { mode: "hug" } },
          fills: [{ type: "solid", color: "#FFFFFF" }],
        },
      },
      props: { role: "list" },
    },
    ...cards,
  ];

  return {
    schemaVersion: 7,
    meta: { title: `Grid wrap ${count}` },
    settings: defaultSiteSettings({ title: `Grid wrap ${count}` }),
    theme: defaultTheme(),
    componentDeps: {},
    assets: {},
    pageOrder: ["pg_home000001"],
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
  };
}

/** Semua field top-level DM-004 terisi (templateRef, componentDeps, dataSources, theme lengkap) — uji mapping. */
export function fullTopLevelDocument(): SiteDocument {
  return {
    ...minimalDocument(),
    meta: {
      title: "Toko Kue Budi",
      createdWith: "template",
      templateRef: { templateId: "tpl_bakery01", version: 3 },
    },
    theme: {
      tokens: {
        color: { primary: "#c2410c", primaryHover: { $token: "color.primary" }, brand: { 600: "#9a3412" } },
        typography: { h1: { fontFamily: { $token: "fontFamily.heading" }, fontSize: { value: 48, unit: "px" } } },
        fontFamily: { heading: "Playfair Display", body: "Inter" },
        space: { "4": { value: 16, unit: "px" } },
        radius: { md: { value: 8, unit: "px" } },
        shadow: { sm: [{ type: "dropShadow", x: 0, y: 1, blur: 2, spread: 0, color: "#0000001a" }] },
        size: { container: { value: 1200, unit: "px" } },
      },
      fonts: [
        { family: "Inter", source: "google", weights: [400, 600], fallback: "sans-serif" },
        { family: "Playfair Display", source: "google", weights: [700], italic: true, fallback: "serif" },
      ],
      modes: { default: "light", available: ["light"] },
    },
    componentDeps: { cmp_navbar0001: { version: 4, source: "library" } },
    dataSources: { collections: ["col_produk0001"] },
  };
}

/** Rich text lengkap DM-013: mark bold/link/textStyle token, list bersarang, hardBreak (T1.8.7). */
export function richTextDocument(): SiteDocument {
  const doc = minimalDocument();
  const page = doc.nodes.pg_home000001;
  if (page?.type !== "page") throw new Error("fixture minimal berubah");
  page.children = ["n_richtext001"];
  doc.nodes.n_richtext001 = {
    id: "n_richtext001",
    type: "text",
    name: "Konten / Promo",
    parentId: "pg_home000001",
    visible: true,
    locked: false,
    style: { base: {} },
    props: {
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            attrs: { align: "center" },
            content: [
              { type: "text", text: "Kue rumahan, " },
              {
                type: "text",
                text: "fresh setiap hari",
                marks: [{ type: "bold" }, { type: "textStyle", attrs: { color: { $token: "color.primary" } } }],
              },
              { type: "hardBreak" },
              {
                type: "text",
                text: "pesan via WhatsApp",
                marks: [
                  { type: "link", attrs: { link: { type: "whatsapp", phone: "6281234567890", message: "Halo" } } },
                ],
              },
            ],
          },
          {
            type: "bulletList",
            content: [
              { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Bolu" }] }] },
              {
                type: "listItem",
                content: [
                  { type: "paragraph", content: [{ type: "text", text: "Kue kering" }] },
                  {
                    type: "orderedList",
                    attrs: { start: 1 },
                    content: [
                      {
                        type: "listItem",
                        content: [{ type: "paragraph", content: [{ type: "text", text: "Nastar" }] }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
  return doc;
}

/** Semua kelompok style M1 (DM-027–DM-032): sizing, position, fills solid+image, stroke, radius, typography, color (T1.8.10). */
export function styledDocument(): SiteDocument {
  const doc = heroDocument();
  doc.theme.fonts.push({ family: "Poppins", source: "google", weights: [400, 700], fallback: "sans-serif" });
  doc.assets.ast_bg00000001 = { kind: "image", width: 1920, height: 1080, mime: "image/webp" };
  const hero = doc.nodes.n_hero000001;
  const title = doc.nodes.n_herottl001;
  const image = doc.nodes.n_heroimg001;
  if (hero?.type !== "frame" || title?.type !== "text" || !image) throw new Error("fixture hero berubah");
  hero.style.base = {
    ...hero.style.base,
    size: {
      width: { mode: "fill" },
      height: { mode: "hug" },
      minHeight: { value: 80, unit: "vh" },
      maxWidth: { $token: "size.container" },
    },
    fills: [
      { type: "image", image: { assetId: "ast_bg00000001", focalPoint: { x: 0.5, y: 0.3 } }, fit: "cover" },
      { type: "solid", color: { $token: "color.background", alpha: 0.6 }, visible: false },
    ],
    strokes: [{ color: "#e5e7eb", width: { value: 1, unit: "px" }, position: "inside", sides: { top: false } }],
    radius: { topLeft: { $token: "radius.md" }, topRight: { value: 16, unit: "px" } },
    color: "#111827",
  };
  hero.style.mobile = { strokes: null, typography: { fontSize: { value: 14, unit: "px" } } };
  title.style.base = {
    ...title.style.base,
    typography: {
      fontFamily: "Poppins",
      fontSize: { value: 56, unit: "px" },
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: { value: -0.02, unit: "em" },
      textTransform: "uppercase",
      textDecoration: "none",
      textAlign: "center",
      fontStyle: "normal",
    },
    color: { $token: "color.primary" },
  };
  title.style.tablet = { typography: { fontWeight: null, lineHeight: { value: 40, unit: "px" } } };
  image.style.base = {
    ...image.style.base,
    position: { type: "absolute", x: 24, y: 12, constraints: { horizontal: "right", vertical: "top" } },
  };
  return doc;
}
