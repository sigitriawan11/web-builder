import {
  button,
  type ComponentSpec,
  FILL,
  flex,
  HUG,
  headingGroup,
  padAll,
  section,
  setChildren,
  size,
  T,
  type Tree,
} from "../builder";

// T3.11.11 (bagian Pricing) — CMP-086: pricing cards (tiga tier) + price list jasa.

const loc = (id: string, en: string) => ({ id, en });
const pricing = (
  slug: string,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec => ({
  slug,
  kind: "section",
  categorySlug: "pricing",
  name,
  displayName: dn,
  description: desc,
  tags: ["pricing", ...tags],
  keywords: { id: ["harga", "paket", "biaya"], en: ["pricing", "plans"] },
  aiHints: "Tampilkan 1–3 paket; sorot paket populer; daftar fitur jelas + 1 tombol per paket.",
  build,
});

function featureLine(tree: Tree, parent: string, text: string): string {
  const it = tree.frame({
    name: "Feature",
    parentId: parent,
    layout: flex("row", { align: "start", gap: 2 }),
    style: { size: size(FILL, HUG) },
  });
  const ic = tree.icon({ name: "Check", parentId: it, icon: "check", color: "color.primary", sizePx: 18 });
  const t = tree.text({
    name: "Text",
    parentId: it,
    text,
    typography: "typography.bodySm",
    color: "color.onSurface",
    tag: "span",
    width: FILL,
  });
  return setChildren(tree, it, [ic, t]);
}

function priceCard(
  tree: Tree,
  parent: string,
  opts: { name: string; price: string; period: string; features: string[]; popular?: boolean; cta: string },
): string {
  const c = tree.frame({
    name: opts.popular ? "CardPopular" : "Card",
    parentId: parent,
    role: "card",
    layout: flex("column", { align: "start", gap: 4, padding: padAll(8) }),
    style: {
      size: size(FILL, HUG),
      fills: [{ type: "solid", color: T("color.background") }],
      radius: T("radius.lg"),
      strokes: [
        {
          color: T(opts.popular ? "color.primary" : "color.border"),
          width: { value: opts.popular ? 2 : 1, unit: "px" },
        },
      ],
    },
  });
  const tier = tree.text({
    name: "Tier",
    parentId: c,
    text: opts.name,
    typography: "typography.h4",
    color: "color.onSurface",
    tag: "h3",
    width: FILL,
  });
  const priceRow = tree.frame({
    name: "Price",
    parentId: c,
    layout: flex("row", { align: "end", gap: 1 }),
    style: { size: size(FILL, HUG) },
  });
  const price = tree.text({
    name: "Amount",
    parentId: priceRow,
    text: opts.price,
    typography: "typography.h1",
    color: "color.onSurface",
    tag: "span",
    width: HUG,
  });
  const period = tree.text({
    name: "Period",
    parentId: priceRow,
    text: opts.period,
    typography: "typography.bodySm",
    color: "color.muted",
    tag: "span",
    width: HUG,
  });
  setChildren(tree, priceRow, [price, period]);
  const list = tree.frame({
    name: "Features",
    parentId: c,
    layout: flex("column", { align: "start", gap: 2 }),
    style: { size: size(FILL, HUG) },
  });
  setChildren(
    tree,
    list,
    opts.features.map((f) => featureLine(tree, list, f)),
  );
  const btn = button(tree, c, { label: opts.cta, variant: opts.popular ? "primary" : "secondary", name: "Cta" });
  return setChildren(tree, c, [tier, priceRow, list, btn]);
}

export const PRICING: ComponentSpec[] = [
  pricing(
    "pricing-3-tiers",
    "Pricing3Tiers",
    loc("Harga 3 Paket", "Three-tier Pricing"),
    loc(
      "Tiga kartu paket harga dengan paket tengah disorot populer.",
      "Three pricing cards with the middle plan highlighted as popular.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "Pricing3Tiers", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        eyebrow: "HARGA",
        heading: "Paket yang pas untuk setiap bisnis",
        lead: "Tanpa biaya tersembunyi. Batalkan kapan saja.",
        maxTextWidth: 640,
      });
      const r = tree.frame({
        name: "Plans",
        parentId: inner,
        layout: flex("row", { align: "stretch", justify: "center", gap: 6, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      const cards = [
        priceCard(tree, r, {
          name: "Mulai",
          price: "Gratis",
          period: "/selamanya",
          features: ["1 website", "Subdomain gratis", "Template dasar"],
          cta: "Mulai Gratis",
        }),
        priceCard(tree, r, {
          name: "Bisnis",
          price: "Rp49rb",
          period: "/bulan",
          features: ["Domain kustom", "Semua template", "Tanpa iklan", "Dukungan prioritas"],
          popular: true,
          cta: "Pilih Bisnis",
        }),
        priceCard(tree, r, {
          name: "Pro",
          price: "Rp99rb",
          period: "/bulan",
          features: ["Semua fitur Bisnis", "Toko online", "Statistik lanjutan"],
          cta: "Pilih Pro",
        }),
      ];
      setChildren(tree, r, cards);
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["tiers"],
  ),

  pricing(
    "pricing-single",
    "PricingSingle",
    loc("Harga Satu Paket", "Single Plan Pricing"),
    loc(
      "Satu kartu harga terpusat untuk penawaran tunggal yang jelas.",
      "A single centered pricing card for one clear offer.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "PricingSingle", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        heading: "Satu harga, semua fitur",
        lead: "Sederhana dan transparan.",
        maxTextWidth: 600,
      });
      const wrap = tree.frame({
        name: "Wrap",
        parentId: inner,
        layout: flex("column", { align: "center" }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 420, unit: "px" } } },
      });
      const cardNode = priceCard(tree, wrap, {
        name: "Paket Lengkap",
        price: "Rp79rb",
        period: "/bulan",
        features: [
          "Website tanpa batas halaman",
          "Domain kustom gratis",
          "Toko online & WhatsApp",
          "Dukungan prioritas 24/7",
        ],
        popular: true,
        cta: "Langganan Sekarang",
      });
      setChildren(tree, wrap, [cardNode]);
      setChildren(tree, inner, [h, wrap]);
      return [root];
    },
    ["single"],
  ),

  pricing(
    "pricing-service-list",
    "PriceList",
    loc("Daftar Harga Jasa", "Service Price List"),
    loc(
      "Daftar layanan dengan harga di sisi kanan tiap baris.",
      "A list of services with prices aligned to the right of each row.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "PriceList", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        heading: "Daftar harga layanan",
        lead: "Harga jujur, tanpa biaya tersembunyi.",
        maxTextWidth: 600,
      });
      const list = tree.frame({
        name: "List",
        parentId: inner,
        layout: flex("column", { align: "stretch", gap: 3 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 680, unit: "px" } } },
      });
      const items: [string, string][] = [
        ["Cuci Mobil Standar", "Rp35rb"],
        ["Cuci + Poles", "Rp75rb"],
        ["Salon Interior", "Rp150rb"],
        ["Paket Lengkap", "Rp250rb"],
      ];
      setChildren(
        tree,
        list,
        items.map(([name, price]) => {
          const rowN = tree.frame({
            name: "Row",
            parentId: list,
            layout: flex("row", { align: "center", justify: "spaceBetween", gap: 4 }),
            style: { size: size(FILL, HUG) },
          });
          const nameT = tree.text({
            name: "Name",
            parentId: rowN,
            text: name,
            typography: "typography.body",
            color: "color.onSurface",
            tag: "span",
            width: FILL,
          });
          const priceT = tree.text({
            name: "Price",
            parentId: rowN,
            text: price,
            typography: "typography.body",
            color: "color.primary",
            tag: "span",
            width: HUG,
          });
          return setChildren(tree, rowN, [nameT, priceT]);
        }),
      );
      setChildren(tree, inner, [h, list]);
      return [root];
    },
    ["service", "list"],
  ),
];
