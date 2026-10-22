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

// T3.11.7 — Features / Benefit (CMP-083): feature grid ikon, alternating, checklist, steps. Section penuh-lebar.

const loc = (id: string, en: string) => ({ id, en });

function feat(
  slug: string,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec {
  return {
    slug,
    kind: "section",
    categorySlug: "features",
    name,
    displayName: dn,
    description: desc,
    tags: ["features", ...tags],
    keywords: { id: ["fitur", "keunggulan", "manfaat"], en: ["features", "benefits"] },
    aiHints: "Daftar 3–6 keunggulan. Tiap item: ikon relevan, judul 2–4 kata, 1 kalimat manfaat konkret.",
    build,
  };
}

const row = (tree: Tree, parent: string, name = "Row", gap = 6): string =>
  tree.frame({
    name,
    parentId: parent,
    layout: flex("row", { align: "stretch", justify: "center", gap, wrap: true }),
    style: { size: size(FILL, HUG) },
  });

function featureCard(tree: Tree, parent: string, icon: string, title: string, text: string): string {
  const c = card(tree, parent, { align: "start", gap: 3, width: FILL });
  const ic = tree.icon({ name: "Icon", parentId: c, icon, color: "color.primary", sizePx: 28 });
  const t = tree.text({
    name: "Title",
    parentId: c,
    text: title,
    typography: "typography.h4",
    color: "color.onSurface",
    tag: "h3",
    width: FILL,
  });
  const b = tree.text({
    name: "Text",
    parentId: c,
    text,
    typography: "typography.body",
    color: "color.muted",
    tag: "p",
    width: FILL,
  });
  return setChildren(tree, c, [ic, t, b]);
}

function checkItem(tree: Tree, parent: string, text: string): string {
  const item = tree.frame({
    name: "Item",
    parentId: parent,
    layout: flex("row", { align: "start", gap: 2 }),
    style: { size: size(FILL, HUG) },
  });
  const ic = tree.icon({ name: "Check", parentId: item, icon: "circle-check", color: "color.success", sizePx: 20 });
  const t = tree.text({
    name: "Text",
    parentId: item,
    text,
    typography: "typography.body",
    color: "color.onSurface",
    tag: "span",
    width: FILL,
  });
  return setChildren(tree, item, [ic, t]);
}

function stepItem(tree: Tree, parent: string, num: string, title: string, text: string): string {
  const c = tree.frame({
    name: "Step",
    parentId: parent,
    layout: flex("column", { align: "start", gap: 3 }),
    style: { size: size(FILL, HUG) },
  });
  const badge = tree.frame({
    name: "Number",
    parentId: c,
    layout: flex("row", { align: "center", justify: "center" }),
    style: {
      size: size({ mode: "fixed", value: 44, unit: "px" } as Json, { mode: "fixed", value: 44, unit: "px" } as Json),
      radius: T("radius.full"),
      fills: [{ type: "solid", color: T("color.primary") }],
    },
  });
  const numText = tree.text({
    name: "Num",
    parentId: badge,
    text: num,
    typography: "typography.h4",
    color: "color.onPrimary",
    tag: "span",
    width: HUG,
  });
  setChildren(tree, badge, [numText]);
  const t = tree.text({
    name: "Title",
    parentId: c,
    text: title,
    typography: "typography.h4",
    color: "color.onSurface",
    tag: "h3",
    width: FILL,
  });
  const b = tree.text({
    name: "Text",
    parentId: c,
    text,
    typography: "typography.body",
    color: "color.muted",
    tag: "p",
    width: FILL,
  });
  return setChildren(tree, c, [badge, t, b]);
}

function statItem(tree: Tree, parent: string, value: string, label: string): string {
  const c = tree.frame({
    name: "Stat",
    parentId: parent,
    layout: flex("column", { align: "center", gap: 1 }),
    style: { size: size(FILL, HUG) },
  });
  const v = tree.text({
    name: "Value",
    parentId: c,
    text: value,
    typography: "typography.h1",
    color: "color.primary",
    tag: "span",
    width: FILL,
  });
  const l = tree.text({
    name: "Label",
    parentId: c,
    text: label,
    typography: "typography.bodySm",
    color: "color.muted",
    tag: "span",
    width: FILL,
  });
  return setChildren(tree, c, [v, l]);
}

const F3 = [
  ["zap", "Cepat & Ringan", "Halaman dimuat kilat di semua perangkat, bahkan koneksi lambat."],
  ["smartphone", "Mobile-friendly", "Tampilan otomatis rapi di layar HP, tablet, maupun desktop."],
  ["shield-check", "Aman & Andal", "Hosting stabil dengan sertifikat SSL gratis di setiap situs."],
  ["palette", "Mudah Diubah", "Ganti teks, warna, dan gambar tanpa perlu menyentuh kode."],
] as const;

export const FEATURES: ComponentSpec[] = [
  feat(
    "features-grid-3",
    "FeatureGrid3",
    loc("Grid Fitur 3 Kolom", "Feature Grid (3 columns)"),
    loc(
      "Tiga kartu fitur berikon dengan judul dan deskripsi singkat.",
      "Three icon feature cards with title and short description.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "FeatureGrid3", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        eyebrow: "KENAPA KAMI",
        heading: "Semua yang Anda butuhkan",
        lead: "Fitur lengkap untuk membuat bisnis Anda tampil profesional.",
        maxTextWidth: 640,
      });
      const r = row(tree, inner);
      setChildren(
        tree,
        r,
        F3.slice(0, 3).map(([i, t, d]) => featureCard(tree, r, i, t, d)),
      );
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["grid"],
  ),

  feat(
    "features-grid-4",
    "FeatureGrid4",
    loc("Grid Fitur 4 Kolom", "Feature Grid (4 columns)"),
    loc("Empat kartu fitur berikon dalam satu baris yang membungkus.", "Four icon feature cards in a wrapping row."),
    (tree) => {
      const { root, inner } = section(tree, { name: "FeatureGrid4", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        heading: "Fitur unggulan",
        lead: "Dibuat untuk membantu bisnis kecil tumbuh lebih cepat.",
        maxTextWidth: 640,
      });
      const r = row(tree, inner);
      setChildren(
        tree,
        r,
        F3.map(([i, t, d]) => featureCard(tree, r, i, t, d)),
      );
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["grid"],
  ),

  feat(
    "features-checklist",
    "FeatureChecklist",
    loc("Daftar Centang Fitur", "Feature Checklist"),
    loc(
      "Judul dengan daftar manfaat bercentang dalam satu kolom.",
      "A title with a single column of checkmarked benefits.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "FeatureChecklist", padY: 20, gap: 6, align: "start" });
      const h = headingGroup(tree, inner, { align: "start", heading: "Kenapa memilih kami", maxTextWidth: 640 });
      const list = tree.frame({
        name: "List",
        parentId: inner,
        layout: flex("column", { align: "start", gap: 3 }),
        style: { size: size(FILL, HUG) },
      });
      const items = [
        "Gratis domain .my.id tahun pertama",
        "Template profesional siap pakai",
        "Integrasi WhatsApp & peta lokasi",
        "Dukungan pelanggan bahasa Indonesia",
      ];
      setChildren(
        tree,
        list,
        items.map((t) => checkItem(tree, list, t)),
      );
      setChildren(tree, inner, [h, list]);
      return [root];
    },
    ["checklist"],
  ),

  feat(
    "features-steps-3",
    "FeatureSteps3",
    loc("Langkah 1-2-3", "Three Steps"),
    loc(
      "Tiga langkah bernomor untuk menjelaskan cara kerja layanan.",
      "Three numbered steps explaining how the service works.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "FeatureSteps3", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        eyebrow: "CARA KERJA",
        heading: "Online dalam 3 langkah",
        lead: "Sederhana, cepat, tanpa ribet.",
        maxTextWidth: 640,
      });
      const r = row(tree, inner);
      const steps: [string, string, string][] = [
        ["1", "Pilih Template", "Pilih desain yang cocok untuk bisnis Anda."],
        ["2", "Ubah Konten", "Ganti teks, gambar, dan warna sesuka hati."],
        ["3", "Publish", "Website langsung online dengan satu klik."],
      ];
      setChildren(
        tree,
        r,
        steps.map(([n, t, d]) => stepItem(tree, r, n, t, d)),
      );
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["steps"],
  ),

  feat(
    "features-alternating",
    "FeatureAlternating",
    loc("Fitur Bergantian", "Alternating Feature"),
    loc(
      "Satu fitur dengan gambar dan teks berdampingan dua kolom.",
      "A single feature with image and text side by side.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "FeatureAlternating", padY: 20, gap: 6 });
      const r = tree.frame({
        name: "Row",
        parentId: inner,
        layout: flex("row", { align: "center", gap: 10 }),
        style: { size: size(FILL, HUG) },
      });
      const textCol = tree.frame({
        name: "Text",
        parentId: r,
        layout: flex("column", { align: "start", gap: 4 }),
        style: { size: size(FILL, HUG) },
      });
      const h = headingGroup(tree, textCol, {
        align: "start",
        eyebrow: "FITUR",
        heading: "Kelola pesanan lebih mudah",
        lead: "Pantau pesanan masuk dan balas pelanggan dari satu tempat.",
        maxTextWidth: 520,
      });
      const list = tree.frame({
        name: "List",
        parentId: textCol,
        layout: flex("column", { align: "start", gap: 2 }),
        style: { size: size(FILL, HUG) },
      });
      setChildren(
        tree,
        list,
        ["Notifikasi real-time", "Riwayat pesanan tersimpan"].map((t) => checkItem(tree, list, t)),
      );
      setChildren(tree, textCol, [h, list]);
      const img = imageBox(tree, r, { name: "FeatureImage", minHeight: 320 });
      setChildren(tree, r, [textCol, img]);
      setChildren(tree, inner, [r]);
      return [root];
    },
    ["alternating"],
  ),

  feat(
    "features-stats",
    "FeatureStats",
    loc("Statistik", "Stats Row"),
    loc("Baris angka pencapaian untuk membangun kepercayaan.", "A row of achievement numbers to build trust."),
    (tree) => {
      const { root, inner } = section(tree, { name: "FeatureStats", padY: 18, gap: 6, surface: true });
      const r = row(tree, inner, "Stats", 8);
      const stats: [string, string][] = [
        ["500+", "Bisnis Online"],
        ["99.9%", "Uptime"],
        ["24/7", "Dukungan"],
        ["4.9★", "Rating Pengguna"],
      ];
      setChildren(
        tree,
        r,
        stats.map(([v, l]) => statItem(tree, r, v, l)),
      );
      setChildren(tree, inner, [r]);
      return [root];
    },
    ["stats"],
  ),

  feat(
    "features-icon-list-2col",
    "FeatureIconList",
    loc("Daftar Ikon 2 Kolom", "Two-column Icon List"),
    loc("Enam keunggulan berikon tersusun dalam dua kolom.", "Six icon benefits arranged in two columns."),
    (tree) => {
      const { root, inner } = section(tree, { name: "FeatureIconList", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, { heading: "Lebih dari sekadar website", maxTextWidth: 640 });
      const r = row(tree, inner, "Columns", 8);
      const col = (items: [string, string][]) => {
        const c = tree.frame({
          name: "Col",
          parentId: r,
          layout: flex("column", { align: "start", gap: 4 }),
          style: { size: size(FILL, HUG) },
        });
        setChildren(
          tree,
          c,
          items.map(([icon, text]) => {
            const it = tree.frame({
              name: "Item",
              parentId: c,
              layout: flex("row", { align: "start", gap: 2 }),
              style: { size: size(FILL, HUG) },
            });
            const ic = tree.icon({ name: "Icon", parentId: it, icon, color: "color.primary", sizePx: 22 });
            const t = tree.text({
              name: "Text",
              parentId: it,
              text,
              typography: "typography.body",
              color: "color.onSurface",
              tag: "span",
              width: FILL,
            });
            return setChildren(tree, it, [ic, t]);
          }),
        );
        return c;
      };
      const c1 = col([
        ["search", "SEO dasar otomatis agar mudah ditemukan"],
        ["gauge", "Performa cepat untuk pengalaman terbaik"],
        ["lock", "Keamanan SSL bawaan"],
      ]);
      const c2 = col([
        ["globe", "Domain kustom mudah dipasang"],
        ["image", "Galeri & media tak terbatas"],
        ["message-circle", "Form kontak & WhatsApp"],
      ]);
      setChildren(tree, r, [c1, c2]);
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["icon-list"],
  ),

  feat(
    "features-grid-2-large",
    "FeatureGrid2",
    loc("Dua Fitur Besar", "Two Large Features"),
    loc(
      "Dua kartu fitur besar berdampingan dengan ikon dan deskripsi.",
      "Two large feature cards side by side with icon and copy.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "FeatureGrid2", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        heading: "Fokus pada yang penting",
        lead: "Dua hal utama yang membuat pelanggan betah.",
        maxTextWidth: 640,
      });
      const r = row(tree, inner);
      setChildren(tree, r, [
        featureCard(
          tree,
          r,
          "sparkles",
          "Desain Memukau",
          "Template modern yang membuat brand Anda terlihat mahal dan terpercaya.",
        ),
        featureCard(
          tree,
          r,
          "rocket",
          "Siap Berkembang",
          "Tambah halaman, produk, dan fitur kapan pun bisnis Anda tumbuh.",
        ),
      ]);
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["grid"],
  ),

  feat(
    "features-split-checklist",
    "FeatureSplitChecklist",
    loc("Fitur + Daftar Centang", "Feature with Checklist"),
    loc(
      "Teks fitur di kiri dan daftar centang manfaat di kanan.",
      "Feature copy on the left and a benefit checklist on the right.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "FeatureSplitChecklist", padY: 20, gap: 6 });
      const r = tree.frame({
        name: "Row",
        parentId: inner,
        layout: flex("row", { align: "start", gap: 10 }),
        style: { size: size(FILL, HUG) },
      });
      const textCol = tree.frame({
        name: "Text",
        parentId: r,
        layout: flex("column", { align: "start", gap: 3 }),
        style: { size: size(FILL, HUG) },
      });
      const h = headingGroup(tree, textCol, {
        align: "start",
        heading: "Dibuat untuk UMKM Indonesia",
        lead: "Semua yang Anda butuhkan untuk mulai jualan online hari ini.",
        maxTextWidth: 480,
      });
      setChildren(tree, textCol, [h]);
      const list = tree.frame({
        name: "List",
        parentId: r,
        layout: flex("column", { align: "start", gap: 3 }),
        style: { size: size(FILL, HUG) },
      });
      setChildren(
        tree,
        list,
        ["Katalog produk sederhana", "Checkout via WhatsApp", "Statistik pengunjung", "Tanpa biaya transaksi"].map(
          (t) => checkItem(tree, list, t),
        ),
      );
      setChildren(tree, r, [textCol, list]);
      setChildren(tree, inner, [r]);
      return [root];
    },
    ["split", "checklist"],
  ),
];
