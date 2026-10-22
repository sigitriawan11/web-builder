import {
  button,
  buttonRow,
  type ComponentSpec,
  FILL,
  flex,
  HUG,
  headingGroup,
  imageBox,
  padXY,
  section,
  setChildren,
  size,
  T,
  type Tree,
} from "../builder";

// T3.11.6 — Hero (CMP-082): centered, split image, background. Section penuh-lebar, root width fill.

const loc = (id: string, en: string) => ({ id, en });

function hero(
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
    categorySlug: "hero",
    name,
    displayName: dn,
    description: desc,
    tags: ["hero", ...tags],
    keywords: { id: ["hero", "pembuka", "judul utama"], en: ["hero", "headline"] },
    aiHints: "Pembuka halaman: judul kuat 4–8 kata, subjudul 1 kalimat manfaat, 1 CTA utama (+1 sekunder opsional).",
    build,
  };
}

const ctaPair = (tree: Tree, parent: string, primary = "Mulai Sekarang", secondary = "Pelajari Lebih") => [
  button(tree, parent, { label: primary, variant: "primary", name: "CtaPrimary" }),
  button(tree, parent, { label: secondary, variant: "ghost", name: "CtaSecondary" }),
];

// Dua kolom (row) — teks + gambar; `reverse` menukar urutan.
function split(tree: Tree, reverse: boolean): string[] {
  const { root, inner } = section(tree, { name: reverse ? "HeroSplitLeft" : "HeroSplitRight", padY: 24, gap: 6 });
  const row = tree.frame({
    name: "Row",
    parentId: inner,
    layout: flex("row", { align: "center", gap: 10 }),
    style: { size: size(FILL, HUG) },
  });
  const textCol = tree.frame({
    name: "Text",
    parentId: row,
    layout: flex("column", { align: "start", gap: 5 }),
    style: { size: size(FILL, HUG) },
  });
  const heading = headingGroup(tree, textCol, {
    align: "start",
    eyebrow: "PLATFORM",
    heading: "Bangun website bisnis Anda dalam hitungan menit",
    lead: "Tanpa koding. Pilih template, ubah teks & gambar, langsung online.",
    headingTypography: "typography.h1",
    headingTag: "h1",
  });
  const actions = buttonRow(tree, textCol, ctaPair(tree, textCol), "start");
  setChildren(tree, textCol, [heading, actions]);
  const img = imageBox(tree, row, { name: "HeroImage", minHeight: 360 });
  setChildren(tree, row, reverse ? [img, textCol] : [textCol, img]);
  setChildren(tree, inner, [row]);
  return [root];
}

export const HERO: ComponentSpec[] = [
  hero(
    "hero-centered",
    "HeroCentered",
    loc("Hero Tengah", "Centered Hero"),
    loc("Pembuka terpusat: judul besar, subjudul, dua tombol.", "Centered opener: big title, subtitle, two buttons."),
    (tree) => {
      const { root, inner } = section(tree, { name: "HeroCentered", padY: 24, gap: 6 });
      const heading = headingGroup(tree, inner, {
        heading: "Website profesional untuk bisnis Anda",
        lead: "Buat, atur, dan publish tanpa koding. Mulai gratis hari ini.",
        headingTypography: "typography.display",
        headingTag: "h1",
        maxTextWidth: 720,
      });
      const actions = buttonRow(tree, inner, ctaPair(tree, inner));
      setChildren(tree, inner, [heading, actions]);
      return [root];
    },
    ["centered"],
  ),

  hero(
    "hero-centered-badge",
    "HeroCenteredBadge",
    loc("Hero Tengah + Badge", "Centered Hero with Badge"),
    loc(
      "Hero terpusat dengan badge pengumuman di atas judul.",
      "Centered hero with an announcement badge above the title.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "HeroCenteredBadge", padY: 24, gap: 5 });
      const badge = tree.frame({
        name: "Badge",
        parentId: inner,
        role: "generic",
        layout: flex("row", { align: "center", justify: "center", padding: padXY(3, 1) }),
        style: {
          size: size(HUG, HUG),
          radius: T("radius.full"),
          fills: [{ type: "solid", color: T("color.surface") }],
        },
      });
      const badgeText = tree.text({
        name: "BadgeText",
        parentId: badge,
        text: "Baru · Versi 2.0",
        typography: "typography.caption",
        color: "color.primary",
        tag: "span",
        width: HUG,
      });
      setChildren(tree, badge, [badgeText]);
      const heading = headingGroup(tree, inner, {
        heading: "Semua yang bisnis Anda butuhkan untuk online",
        lead: "Template siap pakai, editor mudah, dan publish sekali klik.",
        headingTypography: "typography.display",
        headingTag: "h1",
        maxTextWidth: 720,
      });
      const actions = buttonRow(tree, inner, ctaPair(tree, inner));
      setChildren(tree, inner, [badge, heading, actions]);
      return [root];
    },
    ["centered", "badge"],
  ),

  hero(
    "hero-split-image-right",
    "HeroSplitRight",
    loc("Hero Split Kanan", "Hero Split (Image Right)"),
    loc("Teks di kiri, gambar di kanan — dua kolom.", "Text left, image right — two columns."),
    (tree) => split(tree, false),
    ["split"],
  ),
  hero(
    "hero-split-image-left",
    "HeroSplitLeft",
    loc("Hero Split Kiri", "Hero Split (Image Left)"),
    loc("Gambar di kiri, teks dan tombol di kanan — dua kolom.", "Image left, text and buttons right — two columns."),
    (tree) => split(tree, true),
    ["split"],
  ),

  hero(
    "hero-background",
    "HeroBackground",
    loc("Hero Latar", "Background Hero"),
    loc("Hero dengan latar surface penuh dan teks terpusat.", "Hero with full surface background and centered text."),
    (tree) => {
      const { root, inner } = section(tree, { name: "HeroBackground", padY: 28, gap: 6, surface: true });
      const heading = headingGroup(tree, inner, {
        heading: "Tampil beda, menangkan pelanggan",
        lead: "Desain modern yang memuat cepat di semua perangkat.",
        headingTypography: "typography.display",
        headingTag: "h1",
        maxTextWidth: 720,
      });
      const actions = buttonRow(tree, inner, [
        button(tree, inner, { label: "Coba Gratis", variant: "primary", name: "CtaPrimary" }),
      ]);
      setChildren(tree, inner, [heading, actions]);
      return [root];
    },
    ["background"],
  ),

  hero(
    "hero-minimal",
    "HeroMinimal",
    loc("Hero Minimal", "Minimal Hero"),
    loc("Hero ringkas: judul + satu tombol.", "Compact hero: title + one button."),
    (tree) => {
      const { root, inner } = section(tree, { name: "HeroMinimal", padY: 20, gap: 5 });
      const heading = headingGroup(tree, inner, {
        heading: "Mulai jualan online hari ini",
        headingTypography: "typography.h1",
        headingTag: "h1",
        maxTextWidth: 640,
      });
      const actions = buttonRow(tree, inner, [
        button(tree, inner, { label: "Buat Website", variant: "primary", name: "Cta" }),
      ]);
      setChildren(tree, inner, [heading, actions]);
      return [root];
    },
    ["minimal"],
  ),

  hero(
    "hero-whatsapp",
    "HeroWhatsApp",
    loc("Hero WhatsApp", "WhatsApp Hero"),
    loc("Hero dengan CTA WhatsApp untuk UMKM.", "Hero with a WhatsApp CTA for small businesses."),
    (tree) => {
      const { root, inner } = section(tree, { name: "HeroWhatsApp", padY: 24, gap: 6 });
      const heading = headingGroup(tree, inner, {
        eyebrow: "UMKM",
        heading: "Pesan langsung lewat WhatsApp",
        lead: "Pelanggan klik, chat masuk ke WhatsApp Anda. Tanpa ribet.",
        headingTypography: "typography.display",
        headingTag: "h1",
        maxTextWidth: 720,
      });
      const actions = buttonRow(tree, inner, [
        button(tree, inner, {
          label: "Chat WhatsApp",
          variant: "whatsapp",
          icon: "whatsapp",
          iconSet: "brand",
          name: "CtaWa",
        }),
      ]);
      setChildren(tree, inner, [heading, actions]);
      return [root];
    },
    ["whatsapp", "umkm"],
  ),

  hero(
    "hero-left-aligned",
    "HeroLeftAligned",
    loc("Hero Rata Kiri", "Left-aligned Hero"),
    loc(
      "Hero rata kiri tanpa gambar — judul, subjudul, dan tombol.",
      "Left-aligned hero without image — title, subtitle, buttons.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "HeroLeftAligned", padY: 24, gap: 6, align: "start" });
      const heading = headingGroup(tree, inner, {
        align: "start",
        eyebrow: "PLATFORM",
        heading: "Solusi digital untuk pertumbuhan bisnis Anda",
        lead: "Dari landing page hingga toko online, semua dalam satu tempat.",
        headingTypography: "typography.display",
        headingTag: "h1",
        maxTextWidth: 760,
      });
      const actions = buttonRow(tree, inner, ctaPair(tree, inner), "start");
      setChildren(tree, inner, [heading, actions]);
      return [root];
    },
    ["left"],
  ),

  hero(
    "hero-image-below",
    "HeroImageBelow",
    loc("Hero Gambar Bawah", "Hero with Image Below"),
    loc(
      "Hero terpusat dengan gambar besar di bawah teks dan tombol.",
      "Centered hero with a large image below the text and buttons.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "HeroImageBelow", padY: 24, gap: 8 });
      const heading = headingGroup(tree, inner, {
        heading: "Lihat bisnis Anda tumbuh online",
        lead: "Website cepat, rapi, dan siap jualan dalam hitungan menit.",
        headingTypography: "typography.display",
        headingTag: "h1",
        maxTextWidth: 720,
      });
      const actions = buttonRow(tree, inner, ctaPair(tree, inner));
      const img = imageBox(tree, inner, { name: "HeroImage", minHeight: 420 });
      setChildren(tree, inner, [heading, actions, img]);
      return [root];
    },
    ["centered", "image"],
  ),

  hero(
    "hero-trust-logos",
    "HeroTrustLogos",
    loc("Hero + Logo Mitra", "Hero with Trust Logos"),
    loc(
      "Hero terpusat dengan baris logo mitra untuk membangun kepercayaan.",
      "Centered hero with a row of partner logos to build trust.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "HeroTrustLogos", padY: 24, gap: 8 });
      const heading = headingGroup(tree, inner, {
        heading: "Dipercaya oleh ratusan bisnis",
        lead: "Bergabung dengan pelaku usaha yang sudah online bersama kami.",
        headingTypography: "typography.display",
        headingTag: "h1",
        maxTextWidth: 720,
      });
      const actions = buttonRow(tree, inner, ctaPair(tree, inner));
      const logos = tree.frame({
        name: "Logos",
        parentId: inner,
        layout: flex("row", { align: "center", justify: "center", gap: 8, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      const logoIds = [0, 1, 2, 3].map((i) => imageBox(tree, logos, { name: `Logo${i + 1}`, minHeight: 40 }));
      setChildren(tree, logos, logoIds);
      setChildren(tree, inner, [heading, actions, logos]);
      return [root];
    },
    ["logos", "trust"],
  ),
];
