import {
  button,
  type ComponentSpec,
  FILL,
  flex,
  HUG,
  imageBox,
  padXY,
  section,
  setChildren,
  size,
  T,
  type Tree,
} from "../builder";

// T3.11.4 — Navigation / Navbar (CMP-081). kind=layout; bar penuh-lebar (header) dengan logo + link + CTA.

const loc = (id: string, en: string) => ({ id, en });
const nav = (
  slug: string,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec => ({
  slug,
  kind: "layout",
  categorySlug: "navigation",
  name,
  displayName: dn,
  description: desc,
  tags: ["navbar", ...tags],
  keywords: { id: ["navigasi", "menu", "header"], en: ["navbar", "menu", "header"] },
  aiHints: "Header situs: logo kiri, 3–5 link, 1 CTA kanan. Jaga ringkas; link ke section penting.",
  build,
});

const LINKS = ["Beranda", "Fitur", "Harga", "Kontak"];

function bar(tree: Tree, name: string): { root: string; left: string; right: string } {
  const root = tree.frame({
    name,
    parentId: "tmp_parent",
    role: "container",
    tag: "header",
    layout: flex("row", { align: "center", justify: "spaceBetween", gap: 6, padding: padXY(6, 4) }),
    style: {
      size: size(FILL, HUG),
      fills: [{ type: "solid", color: T("color.background") }],
      strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" }, sides: { bottom: true } }],
    },
  });
  const logo = tree.frame({
    name: "Logo",
    parentId: root,
    layout: flex("row", { align: "center", gap: 2 }),
    style: { size: size(HUG, HUG) },
  });
  const logoBox = imageBox(tree, logo, { name: "LogoMark", minHeight: 32 });
  const logoText = tree.text({
    name: "Brand",
    parentId: logo,
    text: "Brand",
    typography: "typography.h4",
    color: "color.onSurface",
    tag: "span",
    width: HUG,
  });
  setChildren(tree, logo, [logoBox, logoText]);
  const right = tree.frame({
    name: "Right",
    parentId: root,
    layout: flex("row", { align: "center", gap: 5 }),
    style: { size: size(HUG, HUG) },
  });
  setChildren(tree, root, [logo, right]);
  return { root, left: logo, right };
}

function navLinks(tree: Tree, parent: string, items = LINKS): string {
  const row = tree.frame({
    name: "Nav",
    parentId: parent,
    tag: "nav",
    layout: flex("row", { align: "center", gap: 4 }),
    style: { size: size(HUG, HUG) },
  });
  setChildren(
    tree,
    row,
    items.map((t, i) =>
      tree.text({
        name: `Link${i + 1}`,
        parentId: row,
        text: t,
        typography: "typography.button",
        color: i === 0 ? "color.onSurface" : "color.muted",
        tag: "span",
        width: HUG,
      }),
    ),
  );
  return row;
}

export const NAVBAR: ComponentSpec[] = [
  nav(
    "navbar-simple",
    "NavbarSimple",
    loc("Navbar Sederhana", "Simple Navbar"),
    loc("Logo di kiri dengan menu navigasi di kanan.", "Logo on the left with the navigation menu on the right."),
    (tree) => {
      const { root, right } = bar(tree, "NavbarSimple");
      setChildren(tree, right, [navLinks(tree, right)]);
      return [root];
    },
    ["simple"],
  ),

  nav(
    "navbar-cta",
    "NavbarCta",
    loc("Navbar + Tombol", "Navbar with CTA"),
    loc(
      "Logo, menu navigasi, dan satu tombol ajakan di kanan.",
      "Logo, navigation menu, and a single call-to-action button.",
    ),
    (tree) => {
      const { root, right } = bar(tree, "NavbarCta");
      setChildren(tree, right, [
        navLinks(tree, right),
        button(tree, right, { label: "Mulai", variant: "primary", name: "Cta", sizeStep: 2 }),
      ]);
      return [root];
    },
    ["cta"],
  ),

  nav(
    "navbar-whatsapp",
    "NavbarWhatsApp",
    loc("Navbar + WhatsApp", "Navbar with WhatsApp"),
    loc("Navbar dengan tombol WhatsApp untuk kontak cepat.", "Navbar with a WhatsApp button for quick contact."),
    (tree) => {
      const { root, right } = bar(tree, "NavbarWhatsApp");
      setChildren(tree, right, [
        navLinks(tree, right),
        button(tree, right, {
          label: "Chat",
          variant: "whatsapp",
          icon: "whatsapp",
          iconSet: "brand",
          name: "Wa",
          sizeStep: 2,
        }),
      ]);
      return [root];
    },
    ["whatsapp"],
  ),

  nav(
    "navbar-two-cta",
    "NavbarTwoCta",
    loc("Navbar 2 Tombol", "Navbar Two Buttons"),
    loc(
      "Navbar dengan tombol masuk dan tombol daftar di kanan.",
      "Navbar with a sign-in and a sign-up button on the right.",
    ),
    (tree) => {
      const { root, right } = bar(tree, "NavbarTwoCta");
      setChildren(tree, right, [
        navLinks(tree, right),
        button(tree, right, { label: "Masuk", variant: "ghost", name: "Login", sizeStep: 2 }),
        button(tree, right, { label: "Daftar", variant: "primary", name: "Signup", sizeStep: 2 }),
      ]);
      return [root];
    },
    ["two-cta"],
  ),

  nav(
    "navbar-minimal",
    "NavbarMinimal",
    loc("Navbar Minimal", "Minimal Navbar"),
    loc(
      "Hanya logo dan satu tombol — cocok untuk landing page.",
      "Just a logo and one button — ideal for a landing page.",
    ),
    (tree) => {
      const { root, right } = bar(tree, "NavbarMinimal");
      setChildren(tree, right, [
        button(tree, right, { label: "Hubungi Kami", variant: "primary", name: "Cta", sizeStep: 2 }),
      ]);
      return [root];
    },
    ["minimal"],
  ),

  nav(
    "navbar-links-right",
    "NavbarLinksRight",
    loc("Navbar Link Kanan", "Navbar Links Right"),
    loc("Menu navigasi lengkap rata kanan tanpa tombol.", "A full right-aligned navigation menu without a button."),
    (tree) => {
      const { root, right } = bar(tree, "NavbarLinksRight");
      setChildren(tree, right, [navLinks(tree, right, ["Beranda", "Tentang", "Layanan", "Galeri", "Kontak"])]);
      return [root];
    },
    ["links"],
  ),

  nav(
    "navbar-mobile",
    "NavbarMobile",
    loc("Navbar Mobile (Drawer)", "Mobile Navbar (Drawer)"),
    loc(
      "Logo dengan ikon menu hamburger untuk tampilan mobile.",
      "Logo with a hamburger menu icon for mobile layouts.",
    ),
    (tree) => {
      const { root, right } = bar(tree, "NavbarMobile");
      const burger = tree.frame({
        name: "MenuButton",
        parentId: right,
        role: "button",
        layout: flex("row", { align: "center", justify: "center", padding: padXY(2, 2) }),
        style: { size: size(HUG, HUG), radius: T("radius.md") },
      });
      const icon = tree.icon({
        name: "MenuIcon",
        parentId: burger,
        icon: "menu",
        color: "color.onSurface",
        sizePx: 24,
      });
      setChildren(tree, burger, [icon]);
      setChildren(tree, right, [burger]);
      return [root];
    },
    ["mobile"],
  ),

  nav(
    "navbar-announcement",
    "NavbarAnnouncement",
    loc("Navbar + Pengumuman", "Navbar with Announcement"),
    loc(
      "Baris pengumuman tipis di atas navbar dengan logo dan tombol.",
      "A thin announcement bar above the navbar with logo and button.",
    ),
    (tree) => {
      const wrapper = tree.frame({
        name: "HeaderStack",
        parentId: "tmp_parent",
        layout: flex("column", { align: "stretch" }),
        style: { size: size(FILL, HUG) },
      });
      const announce = tree.frame({
        name: "Announcement",
        parentId: wrapper,
        layout: flex("row", { align: "center", justify: "center", padding: padXY(4, 2) }),
        style: { size: size(FILL, HUG), fills: [{ type: "solid", color: T("color.primary") }] },
      });
      const announceText = tree.text({
        name: "Text",
        parentId: announce,
        text: "🎉 Promo: diskon 50% paket tahunan — berakhir minggu ini!",
        typography: "typography.bodySm",
        color: "color.onPrimary",
        tag: "span",
        width: HUG,
      });
      setChildren(tree, announce, [announceText]);
      const { root, right } = bar(tree, "Navbar");
      (tree.nodes[root] as { parentId: string }).parentId = wrapper;
      setChildren(tree, right, [
        navLinks(tree, right),
        button(tree, right, { label: "Ambil Promo", variant: "primary", name: "Cta", sizeStep: 2 }),
      ]);
      setChildren(tree, wrapper, [announce, root]);
      return [wrapper];
    },
    ["announcement"],
  ),
];
