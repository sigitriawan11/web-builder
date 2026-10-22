import {
  type ComponentSpec,
  card,
  FILL,
  flex,
  HUG,
  headingGroup,
  imageBox,
  type Json,
  section,
  setChildren,
  size,
  T,
  type Tree,
} from "../builder";

// T3.11.10 — Social proof (CMP-085): testimonial cards, rating, logo cloud, stats.

const loc = (id: string, en: string) => ({ id, en });
const sp = (
  slug: string,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec => ({
  slug,
  kind: "section",
  categorySlug: "social-proof",
  name,
  displayName: dn,
  description: desc,
  tags: ["social-proof", ...tags],
  keywords: { id: ["testimoni", "ulasan", "kepercayaan"], en: ["testimonial", "reviews", "trust"] },
  aiHints: "Bukti sosial jujur: kutipan pelanggan nyata, nama + usaha, rating bintang. Hindari klaim berlebihan.",
  build,
});

const circle = (px: number): Json => ({ mode: "fixed", value: px, unit: "px" });

function avatar(tree: Tree, parent: string, size48 = 48): string {
  return tree.frame({
    name: "Avatar",
    parentId: parent,
    role: "generic",
    style: {
      size: { width: circle(size48), height: circle(size48) },
      fills: [{ type: "solid", color: T("color.surface") }],
      radius: T("radius.full"),
    },
  });
}

function stars(tree: Tree, parent: string, count = 5): string {
  const row = tree.frame({
    name: "Rating",
    parentId: parent,
    layout: flex("row", { align: "center", gap: 1 }),
    style: { size: size(HUG, HUG) },
  });
  const kids = Array.from({ length: count }, (_, i) =>
    tree.icon({ name: `Star${i + 1}`, parentId: row, icon: "star", color: "color.warning", sizePx: 18 }),
  );
  return setChildren(tree, row, kids);
}

function person(tree: Tree, parent: string, name: string, role: string): string {
  const r = tree.frame({
    name: "Person",
    parentId: parent,
    layout: flex("row", { align: "center", gap: 2 }),
    style: { size: size(FILL, HUG) },
  });
  const av = avatar(tree, r);
  const col = tree.frame({
    name: "Meta",
    parentId: r,
    layout: flex("column", { align: "start" }),
    style: { size: size(FILL, HUG) },
  });
  const n = tree.text({
    name: "Name",
    parentId: col,
    text: name,
    typography: "typography.bodySm",
    color: "color.onSurface",
    tag: "span",
    width: FILL,
  });
  const ro = tree.text({
    name: "Role",
    parentId: col,
    text: role,
    typography: "typography.caption",
    color: "color.muted",
    tag: "span",
    width: FILL,
  });
  setChildren(tree, col, [n, ro]);
  return setChildren(tree, r, [av, col]);
}

function tcard(tree: Tree, parent: string, quote: string, name: string, role: string, withStars = false): string {
  const c = card(tree, parent, { align: "start", gap: 4, width: FILL });
  const kids: string[] = [];
  if (withStars) kids.push(stars(tree, c));
  kids.push(
    tree.text({
      name: "Quote",
      parentId: c,
      text: quote,
      typography: "typography.body",
      color: "color.onSurface",
      tag: "p",
      width: FILL,
    }),
  );
  kids.push(person(tree, c, name, role));
  return setChildren(tree, c, kids);
}

const T3: [string, string, string][] = [
  [
    "Website saya jadi dalam sehari dan pelanggan langsung bisa pesan lewat WhatsApp. Sangat membantu!",
    "Budi Santoso",
    "Pemilik Toko Kue",
  ],
  [
    "Tanpa perlu paham teknis, toko online saya sekarang terlihat profesional. Terima kasih!",
    "Siti Rahma",
    "Butik Online",
  ],
  ["Loadingnya cepat dan rapi di HP. Order meningkat sejak punya website sendiri.", "Agus Pratama", "Bengkel Motor"],
];

export const SOCIAL_PROOF: ComponentSpec[] = [
  sp(
    "testimonial-single",
    "TestimonialSingle",
    loc("Testimoni Tunggal", "Single Testimonial"),
    loc(
      "Satu kutipan pelanggan besar dengan foto dan nama di tengah.",
      "A single large customer quote with photo and name, centered.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "TestimonialSingle", padY: 20, gap: 6, surface: true });
      const quote = tree.text({
        name: "Quote",
        parentId: inner,
        text: "“Platform ini mengubah cara saya berjualan. Dalam seminggu, omzet naik dua kali lipat.”",
        typography: "typography.h3",
        color: "color.onSurface",
        tag: "p",
        width: FILL,
      });
      const p = person(tree, inner, "Dewi Lestari", "Pemilik Kedai Kopi");
      setChildren(tree, inner, [quote, p]);
      return [root];
    },
    ["testimonial"],
  ),

  sp(
    "testimonial-grid-3",
    "TestimonialGrid3",
    loc("Grid Testimoni 3", "Testimonial Grid (3)"),
    loc(
      "Tiga kartu testimoni pelanggan berdampingan dengan foto.",
      "Three customer testimonial cards side by side with photos.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "TestimonialGrid3", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        eyebrow: "TESTIMONI",
        heading: "Apa kata pelanggan kami",
        maxTextWidth: 640,
      });
      const r = tree.frame({
        name: "Grid",
        parentId: inner,
        layout: flex("row", { align: "stretch", justify: "center", gap: 6, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      setChildren(
        tree,
        r,
        T3.map(([q, n, ro]) => tcard(tree, r, q, n, ro)),
      );
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["testimonial", "grid"],
  ),

  sp(
    "testimonial-grid-2-rated",
    "TestimonialGrid2Rated",
    loc("Grid Testimoni 2 + Rating", "Two Rated Testimonials"),
    loc(
      "Dua kartu testimoni dengan bintang rating di atas kutipan.",
      "Two testimonial cards with star ratings above the quote.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "TestimonialGrid2Rated", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, { heading: "Dipercaya pelanggan setia", maxTextWidth: 640 });
      const r = tree.frame({
        name: "Grid",
        parentId: inner,
        layout: flex("row", { align: "stretch", justify: "center", gap: 6, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      setChildren(
        tree,
        r,
        T3.slice(0, 2).map(([q, n, ro]) => tcard(tree, r, q, n, ro, true)),
      );
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["testimonial", "rating"],
  ),

  sp(
    "rating-summary",
    "RatingSummary",
    loc("Ringkasan Rating", "Rating Summary"),
    loc(
      "Angka rating besar dengan bintang dan jumlah ulasan.",
      "A large rating number with stars and the number of reviews.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "RatingSummary", padY: 18, gap: 3 });
      const num = tree.text({
        name: "Score",
        parentId: inner,
        text: "4.9",
        typography: "typography.display",
        color: "color.onSurface",
        tag: "span",
        width: FILL,
      });
      const st = stars(tree, inner);
      const count = tree.text({
        name: "Count",
        parentId: inner,
        text: "dari 1.200+ ulasan pelanggan",
        typography: "typography.body",
        color: "color.muted",
        tag: "p",
        width: FILL,
      });
      setChildren(tree, inner, [num, st, count]);
      return [root];
    },
    ["rating"],
  ),

  sp(
    "logo-cloud",
    "LogoCloud",
    loc("Barisan Logo", "Logo Cloud"),
    loc("Judul kecil dengan barisan logo mitra atau klien.", "A small title with a row of partner or client logos."),
    (tree) => {
      const { root, inner } = section(tree, { name: "LogoCloud", padY: 16, gap: 6 });
      const label = tree.text({
        name: "Label",
        parentId: inner,
        text: "Dipercaya oleh bisnis di seluruh Indonesia",
        typography: "typography.overline",
        color: "color.muted",
        tag: "p",
        width: FILL,
      });
      const logos = tree.frame({
        name: "Logos",
        parentId: inner,
        layout: flex("row", { align: "center", justify: "center", gap: 8, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      setChildren(
        tree,
        logos,
        [0, 1, 2, 3, 4].map((i) => imageBox(tree, logos, { name: `Logo${i + 1}`, minHeight: 36 })),
      );
      setChildren(tree, inner, [label, logos]);
      return [root];
    },
    ["logos"],
  ),

  sp(
    "social-proof-stats",
    "SocialStats",
    loc("Statistik Kepercayaan", "Trust Stats"),
    loc("Baris angka pencapaian sebagai bukti sosial.", "A row of achievement numbers as social proof."),
    (tree) => {
      const { root, inner } = section(tree, { name: "SocialStats", padY: 18, gap: 6 });
      const r = tree.frame({
        name: "Stats",
        parentId: inner,
        layout: flex("row", { align: "center", justify: "center", gap: 8, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      const data: [string, string][] = [
        ["10rb+", "Pengguna aktif"],
        ["50rb+", "Website dibuat"],
        ["4.9★", "Rating rata-rata"],
      ];
      setChildren(
        tree,
        r,
        data.map(([v, l]) => {
          const c = tree.frame({
            name: "Stat",
            parentId: r,
            layout: flex("column", { align: "center", gap: 1 }),
            style: { size: size(FILL, HUG) },
          });
          const vv = tree.text({
            name: "Value",
            parentId: c,
            text: v,
            typography: "typography.h1",
            color: "color.primary",
            tag: "span",
            width: FILL,
          });
          const ll = tree.text({
            name: "Label",
            parentId: c,
            text: l,
            typography: "typography.bodySm",
            color: "color.muted",
            tag: "span",
            width: FILL,
          });
          return setChildren(tree, c, [vv, ll]);
        }),
      );
      setChildren(tree, inner, [r]);
      return [root];
    },
    ["stats"],
  ),

  sp(
    "quote-banner",
    "QuoteBanner",
    loc("Banner Kutipan", "Quote Banner"),
    loc("Kutipan besar terpusat sebagai sorotan testimoni.", "A large centered quote as a highlighted testimonial."),
    (tree) => {
      const { root, inner } = section(tree, { name: "QuoteBanner", padY: 22, gap: 4 });
      const icon = tree.icon({ name: "QuoteIcon", parentId: inner, icon: "quote", color: "color.primary", sizePx: 40 });
      const quote = tree.text({
        name: "Quote",
        parentId: inner,
        text: "“Akhirnya bisnis kecil seperti kami punya website yang terlihat profesional.”",
        typography: "typography.h2",
        color: "color.onSurface",
        tag: "p",
        width: FILL,
      });
      const who = tree.text({
        name: "Who",
        parentId: inner,
        text: "— Rina, Pemilik Katering",
        typography: "typography.body",
        color: "color.muted",
        tag: "p",
        width: FILL,
      });
      setChildren(tree, inner, [icon, quote, who]);
      return [root];
    },
    ["quote"],
  ),

  sp(
    "testimonial-list",
    "TestimonialList",
    loc("Daftar Testimoni", "Testimonial List"),
    loc(
      "Tiga testimoni bertumpuk vertikal dengan foto dan nama.",
      "Three vertically stacked testimonials with photo and name.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "TestimonialList", padY: 20, gap: 6, align: "start" });
      const h = headingGroup(tree, inner, { align: "start", heading: "Cerita dari pengguna kami", maxTextWidth: 640 });
      const list = tree.frame({
        name: "List",
        parentId: inner,
        layout: flex("column", { align: "start", gap: 6 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 760, unit: "px" } } },
      });
      setChildren(
        tree,
        list,
        T3.map(([q, n, ro]) => tcard(tree, list, q, n, ro)),
      );
      setChildren(tree, inner, [h, list]);
      return [root];
    },
    ["testimonial", "list"],
  ),
];
