import {
  type ButtonVariant,
  button,
  type ComponentSpec,
  flex,
  HUG,
  type Json,
  padXY,
  T,
  type Tree,
} from "../builder";

// T3.11.2 — Elements batch 1: Buttons (secondary/ghost/WhatsApp + size), Badges, Dividers. ≥10 varian.
// Catatan: `button-primary` sudah ada (hand-written); di sini varian lainnya.

const loc = (id: string, en: string) => ({ id, en });

function btnSpec(
  slug: string,
  variant: ButtonVariant,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  label: string,
  extra: { icon?: string; iconSet?: "lucide" | "brand"; sizeStep?: number } = {},
): ComponentSpec {
  return {
    slug,
    kind: "element",
    categorySlug: "elements",
    name,
    displayName: dn,
    description: desc,
    tags: ["button", variant],
    keywords: { id: ["tombol", "ajakan"], en: ["button", "cta"] },
    aiHints: "Satu aksi per section. Isi label dengan kata kerja singkat; pasang link WhatsApp atau halaman tujuan.",
    build: (tree: Tree) => [button(tree, "tmp_parent", { label, variant, ...extra })],
  };
}

// Pill badge: frame row kecil (radius full) + label caption.
function badge(
  tree: Tree,
  opts: { label: string; fill?: string; textColor: string; outline?: boolean; soft?: boolean },
): string {
  const style: Json = {
    size: { width: HUG, height: HUG },
    radius: T("radius.full"),
    ...(opts.fill ? { fills: [{ type: "solid", color: T(opts.fill) }] } : {}),
    ...(opts.outline ? { strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" } }] } : {}),
  };
  const root = tree.frame({
    name: "Badge",
    parentId: "tmp_parent",
    role: "generic",
    layout: flex("row", { align: "center", justify: "center", padding: padXY(3, 1) }),
    style,
  });
  const label = tree.text({
    name: "Label",
    parentId: root,
    text: opts.label,
    typography: "typography.caption",
    color: opts.textColor,
    tag: "span",
    width: HUG,
  });
  (tree.nodes[root] as { children: string[] }).children = [label];
  return root;
}

export const ELEMENTS: ComponentSpec[] = [
  btnSpec(
    "button-secondary",
    "secondary",
    "ButtonSecondary",
    loc("Tombol Sekunder", "Secondary Button"),
    loc(
      "Tombol aksi sekunder dengan garis tepi untuk aksi pendukung.",
      "Secondary outlined action button for supporting actions.",
    ),
    "Pelajari Lebih",
  ),
  btnSpec(
    "button-ghost",
    "ghost",
    "ButtonGhost",
    loc("Tombol Ghost", "Ghost Button"),
    loc("Tombol tanpa latar untuk aksi ringan (mis. navigasi).", "Background-less button for low-emphasis actions."),
    "Lihat Selengkapnya",
  ),
  btnSpec(
    "button-whatsapp",
    "whatsapp",
    "ButtonWhatsApp",
    loc("Tombol WhatsApp", "WhatsApp Button"),
    loc("Tombol hijau dengan ikon WhatsApp untuk chat langsung.", "Green WhatsApp button for direct chat."),
    "Chat WhatsApp",
    { icon: "whatsapp", iconSet: "brand" },
  ),
  btnSpec(
    "button-primary-lg",
    "primary",
    "ButtonLarge",
    loc("Tombol Besar", "Large Button"),
    loc("Tombol utama ukuran besar untuk hero/CTA.", "Large primary button for hero/CTA."),
    "Mulai Sekarang",
    { sizeStep: 4 },
  ),
  btnSpec(
    "button-primary-sm",
    "primary",
    "ButtonSmall",
    loc("Tombol Kecil", "Small Button"),
    loc("Tombol utama ukuran kecil untuk ruang sempit.", "Small primary button for tight spaces."),
    "Pesan",
    { sizeStep: 2 },
  ),

  {
    slug: "badge-solid",
    kind: "element",
    categorySlug: "elements",
    name: "BadgeSolid",
    displayName: loc("Badge Solid", "Solid Badge"),
    description: loc(
      'Label kecil berlatar primer (mis. "Baru", "Promo").',
      'Small primary-filled label (e.g. "New", "Sale").',
    ),
    tags: ["badge", "label"],
    keywords: { id: ["label", "status"], en: ["badge", "tag"] },
    aiHints: "Penanda status singkat 1–2 kata; jangan untuk kalimat panjang.",
    build: (tree) => [badge(tree, { label: "Baru", fill: "color.primary", textColor: "color.onPrimary" })],
  },
  {
    slug: "badge-outline",
    kind: "element",
    categorySlug: "elements",
    name: "BadgeOutline",
    displayName: loc("Badge Garis", "Outline Badge"),
    description: loc("Label kecil bergaris tepi, latar transparan.", "Small outlined label on transparent background."),
    tags: ["badge", "outline"],
    keywords: { id: ["label", "kategori"], en: ["badge", "category"] },
    aiHints: "Penanda kategori/tag; teks pendek.",
    build: (tree) => [badge(tree, { label: "Kategori", outline: true, textColor: "color.onSurface" })],
  },
  {
    slug: "badge-soft",
    kind: "element",
    categorySlug: "elements",
    name: "BadgeSoft",
    displayName: loc("Badge Lembut", "Soft Badge"),
    description: loc(
      "Label kecil berlatar surface dengan teks primer.",
      "Small surface-filled label with primary text.",
    ),
    tags: ["badge", "soft"],
    keywords: { id: ["label", "fitur"], en: ["badge", "feature"] },
    aiHints: "Penanda fitur/highlight; teks pendek.",
    build: (tree) => [badge(tree, { label: "Unggulan", fill: "color.surface", textColor: "color.primary" })],
  },

  {
    slug: "divider-line",
    kind: "element",
    categorySlug: "elements",
    name: "Divider",
    displayName: loc("Garis Pembatas", "Divider"),
    description: loc("Garis tipis selebar penuh untuk memisahkan konten.", "Thin full-width line to separate content."),
    tags: ["divider", "separator"],
    keywords: { id: ["pembatas", "garis"], en: ["divider", "separator"] },
    aiHints: "Pemisah antar blok konten; jangan dipakai sebagai dekorasi tebal.",
    build: (tree) => [tree.divider({ name: "Divider", parentId: "tmp_parent" })],
  },
  {
    slug: "icon-chip",
    kind: "element",
    categorySlug: "elements",
    name: "IconChip",
    displayName: loc("Chip Ikon", "Icon Chip"),
    description: loc(
      "Chip kecil berisi ikon + label untuk fitur/keunggulan.",
      "Small chip with icon + label for a feature/benefit.",
    ),
    tags: ["chip", "feature"],
    keywords: { id: ["fitur", "keunggulan"], en: ["feature", "benefit"] },
    aiHints: "Highlight satu keunggulan singkat; ikon Lucide relevan + 1–3 kata.",
    build: (tree) => {
      const root = tree.frame({
        name: "Chip",
        parentId: "tmp_parent",
        role: "generic",
        layout: flex("row", { align: "center", gap: 2, padding: padXY(4, 2) }),
        style: {
          size: { width: HUG, height: HUG },
          radius: T("radius.full"),
          fills: [{ type: "solid", color: T("color.surface") }],
        },
      });
      const icon = tree.icon({ name: "ChipIcon", parentId: root, icon: "check", color: "color.primary", sizePx: 18 });
      const label = tree.text({
        name: "Label",
        parentId: root,
        text: "Gratis Ongkir",
        typography: "typography.bodySm",
        color: "color.onSurface",
        tag: "span",
        width: HUG,
      });
      (tree.nodes[root] as { children: string[] }).children = [icon, label];
      return [root];
    },
  },
];
