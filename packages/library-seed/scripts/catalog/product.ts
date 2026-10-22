import {
  button,
  type ComponentSpec,
  FILL,
  flex,
  HUG,
  headingGroup,
  imageBox,
  padAll,
  padXY,
  section,
  setChildren,
  size,
  T,
  type Tree,
} from "../builder";

// T3.11.13 — Product & Cards umum (CMP-088): product card statis, service card, info card. kind=section/element.

const loc = (id: string, en: string) => ({ id, en });
const pc = (
  slug: string,
  name: string,
  kind: "section" | "element",
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  aiHints: string,
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec => ({
  slug,
  kind,
  categorySlug: "product",
  name,
  displayName: dn,
  description: desc,
  tags,
  keywords: { id: ["produk", "kartu", "layanan"], en: ["product", "card", "service"] },
  aiHints,
  build,
});

const PRODUCTS: [string, string][] = [
  ["Kaos Katun Premium", "Rp120rb"],
  ["Tas Kanvas", "Rp185rb"],
  ["Topi Rajut", "Rp75rb"],
];
function productCard(tree: Tree, parent: string, name: string, price: string, sale = false): string {
  const c = tree.frame({
    name: "Product",
    parentId: parent,
    role: "card",
    layout: flex("column", { align: "start", gap: 2 }),
    style: {
      size: size(FILL, HUG),
      fills: [{ type: "solid", color: T("color.background") }],
      radius: T("radius.lg"),
      strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" } }],
    },
  });
  const imgWrap = tree.frame({
    name: "Media",
    parentId: c,
    layout: flex("column", { align: "start" }),
    style: { size: size(FILL, HUG) },
  });
  const img = imageBox(tree, imgWrap, { name: "Photo", aspect: 1 });
  const imgKids = [img];
  if (sale) {
    const badge = tree.frame({
      name: "Badge",
      parentId: imgWrap,
      role: "generic",
      layout: flex("row", { align: "center", justify: "center", padding: padXY(2, 1) }),
      style: { size: size(HUG, HUG), fills: [{ type: "solid", color: T("color.danger") }], radius: T("radius.full") },
    });
    const bt = tree.text({
      name: "Text",
      parentId: badge,
      text: "Diskon",
      typography: "typography.caption",
      color: "color.onPrimary",
      tag: "span",
      width: HUG,
    });
    setChildren(tree, badge, [bt]);
    imgKids.push(badge);
  }
  setChildren(tree, imgWrap, imgKids);
  const body = tree.frame({
    name: "Body",
    parentId: c,
    layout: flex("column", { align: "start", gap: 2, padding: padAll(4) }),
    style: { size: size(FILL, HUG) },
  });
  const nm = tree.text({
    name: "Name",
    parentId: body,
    text: name,
    typography: "typography.h4",
    color: "color.onSurface",
    tag: "h3",
    width: FILL,
  });
  const priceRow = tree.frame({
    name: "PriceRow",
    parentId: body,
    layout: flex("row", { align: "center", gap: 2 }),
    style: { size: size(FILL, HUG) },
  });
  const pr = tree.text({
    name: "Price",
    parentId: priceRow,
    text: price,
    typography: "typography.h4",
    color: "color.primary",
    tag: "span",
    width: HUG,
  });
  const priceKids = [pr];
  if (sale) {
    const old = tree.text({
      name: "Old",
      parentId: priceRow,
      text: "Rp160rb",
      typography: "typography.bodySm",
      color: "color.muted",
      tag: "span",
      width: HUG,
    });
    priceKids.push(old);
  }
  setChildren(tree, priceRow, priceKids);
  const btn = button(tree, body, { label: "Tambah ke Keranjang", variant: "primary", name: "Add", sizeStep: 2 });
  setChildren(tree, body, [nm, priceRow, btn]);
  return setChildren(tree, c, [imgWrap, body]);
}

const SERVICES: [string, string, string][] = [
  ["sparkles", "Desain Profesional", "Template rapi siap pakai untuk berbagai jenis bisnis."],
  ["rocket", "Cepat Online", "Publish website Anda hanya dalam hitungan menit."],
  ["shield-check", "Aman & Andal", "Hosting stabil dengan sertifikat keamanan otomatis."],
];
function serviceCard(tree: Tree, parent: string, icon: string, title: string, desc: string): string {
  const c = tree.frame({
    name: "Service",
    parentId: parent,
    role: "card",
    layout: flex("column", { align: "start", gap: 2, padding: padAll(6) }),
    style: { size: size(FILL, HUG), fills: [{ type: "solid", color: T("color.surface") }], radius: T("radius.lg") },
  });
  const ic = tree.icon({ name: "Icon", parentId: c, icon, color: "color.primary", sizePx: 32 });
  const tt = tree.text({
    name: "Title",
    parentId: c,
    text: title,
    typography: "typography.h4",
    color: "color.onSurface",
    tag: "h3",
    width: FILL,
  });
  const dd = tree.text({
    name: "Desc",
    parentId: c,
    text: desc,
    typography: "typography.body",
    color: "color.muted",
    tag: "p",
    width: FILL,
  });
  return setChildren(tree, c, [ic, tt, dd]);
}

export const PRODUCT: ComponentSpec[] = [
  pc(
    "product-card",
    "ProductCard",
    "element",
    loc("Kartu Produk", "Product Card"),
    loc(
      "Kartu produk dengan foto, nama, harga, dan tombol beli.",
      "A product card with photo, name, price, and a buy button.",
    ),
    "Satu kartu produk. Untuk katalog, susun beberapa dalam grid.",
    (tree) => [productCard(tree, "tmp_parent", "Kaos Katun Premium", "Rp120rb")],
    ["product", "card"],
  ),

  pc(
    "product-card-sale",
    "ProductCardSale",
    "element",
    loc("Kartu Produk Diskon", "Product Card (Sale)"),
    loc(
      "Kartu produk dengan label diskon dan harga coret.",
      "A product card with a sale badge and a struck-through old price.",
    ),
    "Kartu produk promo: tampilkan badge diskon + harga lama dicoret.",
    (tree) => [productCard(tree, "tmp_parent", "Tas Kanvas", "Rp120rb", true)],
    ["product", "card", "sale"],
  ),

  pc(
    "product-grid",
    "ProductGrid",
    "section",
    loc("Grid Produk", "Product Grid"),
    loc(
      "Bagian katalog dengan judul dan beberapa kartu produk.",
      "A catalog section with a title and several product cards.",
    ),
    "Katalog produk 3+ item dalam grid. Judul di atas.",
    (tree) => {
      const { root, inner } = section(tree, { name: "ProductGrid", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        eyebrow: "KATALOG",
        heading: "Produk unggulan",
        lead: "Pilihan terbaik untuk Anda.",
        maxTextWidth: 600,
      });
      const grid = tree.frame({
        name: "Grid",
        parentId: inner,
        layout: flex("row", { align: "stretch", justify: "center", gap: 6, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      setChildren(
        tree,
        grid,
        PRODUCTS.map(([n, p]) => productCard(tree, grid, n, p)),
      );
      setChildren(tree, inner, [h, grid]);
      return [root];
    },
    ["product", "grid"],
  ),

  pc(
    "service-card",
    "ServiceCard",
    "element",
    loc("Kartu Layanan", "Service Card"),
    loc(
      "Kartu layanan dengan ikon, judul, dan deskripsi singkat.",
      "A service card with an icon, title, and short description.",
    ),
    "Satu kartu layanan/benefit. Ikon + judul + 1 kalimat.",
    (tree) => [
      serviceCard(
        tree,
        "tmp_parent",
        "sparkles",
        "Desain Profesional",
        "Template rapi siap pakai untuk berbagai jenis bisnis.",
      ),
    ],
    ["service", "card"],
  ),

  pc(
    "service-grid",
    "ServiceGrid",
    "section",
    loc("Grid Layanan", "Service Grid"),
    loc(
      "Bagian layanan dengan tiga kartu ber-ikon dan judul.",
      "A services section with three icon cards and a heading.",
    ),
    "Tiga layanan/benefit utama dalam grid. Ikon konsisten.",
    (tree) => {
      const { root, inner } = section(tree, { name: "ServiceGrid", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        heading: "Layanan kami",
        lead: "Semua yang Anda butuhkan dalam satu tempat.",
        maxTextWidth: 600,
      });
      const grid = tree.frame({
        name: "Grid",
        parentId: inner,
        layout: flex("row", { align: "stretch", justify: "center", gap: 6, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      setChildren(
        tree,
        grid,
        SERVICES.map(([i, t, d]) => serviceCard(tree, grid, i, t, d)),
      );
      setChildren(tree, inner, [h, grid]);
      return [root];
    },
    ["service", "grid"],
  ),

  pc(
    "info-card",
    "InfoCard",
    "element",
    loc("Kartu Info", "Info Card"),
    loc(
      "Kartu informasi serbaguna dengan ikon, judul, teks, dan tautan.",
      "A versatile info card with icon, title, text, and a link.",
    ),
    "Kartu info umum. Pakai untuk fitur, kategori, atau pengumuman.",
    (tree) => {
      const c = tree.frame({
        name: "InfoCard",
        parentId: "tmp_parent",
        role: "card",
        layout: flex("column", { align: "start", gap: 2, padding: padAll(6) }),
        style: {
          size: size(FILL, HUG),
          fills: [{ type: "solid", color: T("color.background") }],
          radius: T("radius.lg"),
          strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" } }],
        },
      });
      const ic = tree.icon({ name: "Icon", parentId: c, icon: "info", color: "color.primary", sizePx: 28 });
      const tt = tree.text({
        name: "Title",
        parentId: c,
        text: "Judul informasi",
        typography: "typography.h4",
        color: "color.onSurface",
        tag: "h3",
        width: FILL,
      });
      const dd = tree.text({
        name: "Desc",
        parentId: c,
        text: "Keterangan singkat yang menjelaskan isi kartu ini kepada pembaca.",
        typography: "typography.body",
        color: "color.muted",
        tag: "p",
        width: FILL,
      });
      const link = tree.text({
        name: "Link",
        parentId: c,
        text: "Pelajari lebih lanjut →",
        typography: "typography.button",
        color: "color.primary",
        tag: "span",
        width: HUG,
      });
      setChildren(tree, c, [ic, tt, dd, link]);
      return [c];
    },
    ["info", "card"],
  ),

  pc(
    "info-card-grid",
    "InfoCardGrid",
    "section",
    loc("Grid Kartu Info", "Info Card Grid"),
    loc(
      "Bagian dengan tiga kartu info ber-ikon dan judul bagian.",
      "A section with three icon info cards and a section heading.",
    ),
    "Tiga kartu info sejajar. Cocok untuk kategori atau langkah.",
    (tree) => {
      const { root, inner } = section(tree, { name: "InfoCardGrid", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, { heading: "Yang perlu Anda tahu", maxTextWidth: 600 });
      const grid = tree.frame({
        name: "Grid",
        parentId: inner,
        layout: flex("row", { align: "stretch", justify: "center", gap: 6, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      const cards: [string, string, string][] = [
        ["truck", "Pengiriman cepat", "Sampai dalam 1–3 hari ke seluruh Indonesia."],
        ["badge-check", "Garansi resmi", "Setiap produk bergaransi dan bisa ditukar."],
        ["headset", "Dukungan 24/7", "Tim kami siap membantu kapan saja Anda butuh."],
      ];
      setChildren(
        tree,
        grid,
        cards.map(([icon, t, d]) => {
          const c = tree.frame({
            name: "Card",
            parentId: grid,
            role: "card",
            layout: flex("column", { align: "start", gap: 2, padding: padAll(6) }),
            style: {
              size: size(FILL, HUG),
              fills: [{ type: "solid", color: T("color.surface") }],
              radius: T("radius.lg"),
            },
          });
          const ic = tree.icon({ name: "Icon", parentId: c, icon, color: "color.primary", sizePx: 28 });
          const tt = tree.text({
            name: "Title",
            parentId: c,
            text: t,
            typography: "typography.h4",
            color: "color.onSurface",
            tag: "h3",
            width: FILL,
          });
          const dd = tree.text({
            name: "Desc",
            parentId: c,
            text: d,
            typography: "typography.body",
            color: "color.muted",
            tag: "p",
            width: FILL,
          });
          return setChildren(tree, c, [ic, tt, dd]);
        }),
      );
      setChildren(tree, inner, [h, grid]);
      return [root];
    },
    ["info", "grid"],
  ),
];
