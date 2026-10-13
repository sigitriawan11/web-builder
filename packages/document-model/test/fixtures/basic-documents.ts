import type { SiteDocument } from "../../src";

// DM-004 AC: dokumen kosong minimal (1 page tanpa child) harus valid.
export function minimalDocument(): SiteDocument {
  return {
    schemaVersion: 1,
    meta: { title: "Situs Kosong", createdWith: "blank" },
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
    schemaVersion: 1,
    meta: { title: "Toko Kue Budi", createdWith: "template" },
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

  return {
    schemaVersion: 1,
    meta: { title: "Kasus Tepi" },
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
    schemaVersion: 1,
    meta: { title: "Papan Bebas" },
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
        style: { base: { position: { type: "absolute", x: 420, y: 120 }, size: { width: fixed(320), height: fixed(200) } } },
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
        style: { base: { position: { type: "absolute", x: 80, y: 320 }, size: { width: fixed(400), height: { mode: "hug" } } } },
        props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Seret aku ke mana saja" }] }] } },
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
  const frame = (id: string, parentId: string, name: string, children: string[], style: Node["style"]["base"]): Node => ({
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
  const text = (id: string, parentId: string, value: string, size: NonNullable<Node["style"]["base"]["size"]>): Node => ({
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
      layout: { mode: "flex", direction: "column", gap: px(8), padding: pad(16), justify: "spaceBetween", align: "stretch" },
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
    schemaVersion: 1,
    meta: { title: "Auto-layout" },
    assets: {},
    pageOrder: ["pg_home000001"],
    nodes: Object.fromEntries(nodes.map((node) => [node.id, node])),
  };
}
