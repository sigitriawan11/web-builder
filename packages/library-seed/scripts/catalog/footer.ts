import {
  button,
  type ComponentSpec,
  FILL,
  flex,
  HUG,
  imageBox,
  inputBox,
  padAll,
  padXY,
  setChildren,
  size,
  T,
  type Tree,
} from "../builder";

// T3.11.5 — Navigation / Footer (CMP-081): footer kolom + floating WhatsApp. kind=layout.

const loc = (id: string, en: string) => ({ id, en });
const foot = (
  slug: string,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  kind: "layout" | "element",
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec => ({
  slug,
  kind,
  categorySlug: "navigation",
  name,
  displayName: dn,
  description: desc,
  tags: ["footer", ...tags],
  keywords: { id: ["footer", "kaki", "tautan"], en: ["footer", "links"] },
  aiHints: "Kaki situs: tautan penting, info kontak, hak cipta. Jaga rapi dan ringkas.",
  build,
});

function footerRoot(tree: Tree, name: string): string {
  return tree.frame({
    name,
    parentId: "tmp_parent",
    role: "container",
    tag: "footer",
    layout: flex("column", { align: "stretch", gap: 8, padding: padXY(6, 12) }),
    style: { size: size(FILL, HUG), fills: [{ type: "solid", color: T("color.surface") }] },
  });
}
const link = (tree: Tree, parent: string, text: string, i: number): string =>
  tree.text({
    name: `Link${i}`,
    parentId: parent,
    text,
    typography: "typography.bodySm",
    color: "color.muted",
    tag: "span",
    width: HUG,
  });

function linkColumn(tree: Tree, parent: string, title: string, items: string[]): string {
  const col = tree.frame({
    name: "Column",
    parentId: parent,
    layout: flex("column", { align: "start", gap: 2 }),
    style: { size: size(FILL, HUG) },
  });
  const h = tree.text({
    name: "ColTitle",
    parentId: col,
    text: title,
    typography: "typography.overline",
    color: "color.onSurface",
    tag: "h4",
    width: FILL,
  });
  const links = items.map((t, i) => link(tree, col, t, i + 1));
  return setChildren(tree, col, [h, ...links]);
}
function brandCol(tree: Tree, parent: string): string {
  const col = tree.frame({
    name: "Brand",
    parentId: parent,
    layout: flex("column", { align: "start", gap: 2 }),
    style: { size: size(FILL, HUG) },
  });
  const logo = imageBox(tree, col, { name: "Logo", minHeight: 32 });
  const tag = tree.text({
    name: "Tagline",
    parentId: col,
    text: "Buat website bisnis Anda tanpa koding.",
    typography: "typography.bodySm",
    color: "color.muted",
    tag: "p",
    width: FILL,
  });
  return setChildren(tree, col, [logo, tag]);
}
const copyright = (tree: Tree, parent: string): string =>
  tree.text({
    name: "Copyright",
    parentId: parent,
    text: "© 2026 Brand. Semua hak dilindungi.",
    typography: "typography.caption",
    color: "color.muted",
    tag: "p",
    width: FILL,
  });

export const FOOTER: ComponentSpec[] = [
  foot(
    "footer-columns",
    "FooterColumns",
    loc("Footer Kolom", "Footer Columns"),
    loc(
      "Footer dengan brand dan beberapa kolom tautan serta hak cipta.",
      "Footer with brand and several link columns plus copyright.",
    ),
    "layout",
    (tree) => {
      const root = footerRoot(tree, "FooterColumns");
      const row = tree.frame({
        name: "Columns",
        parentId: root,
        layout: flex("row", { align: "start", gap: 8, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      setChildren(tree, row, [
        brandCol(tree, row),
        linkColumn(tree, row, "Produk", ["Fitur", "Harga", "Template"]),
        linkColumn(tree, row, "Perusahaan", ["Tentang", "Blog", "Karier"]),
        linkColumn(tree, row, "Bantuan", ["Pusat Bantuan", "Kontak", "Status"]),
      ]);
      setChildren(tree, root, [row, copyright(tree, root)]);
      return [root];
    },
    ["columns"],
  ),

  foot(
    "footer-simple",
    "FooterSimple",
    loc("Footer Sederhana", "Simple Footer"),
    loc(
      "Footer ringkas dengan logo, baris tautan, dan hak cipta.",
      "A compact footer with logo, a row of links, and copyright.",
    ),
    "layout",
    (tree) => {
      const root = footerRoot(tree, "FooterSimple");
      const row = tree.frame({
        name: "Row",
        parentId: root,
        layout: flex("row", { align: "center", justify: "spaceBetween", gap: 6, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      const logo = imageBox(tree, row, { name: "Logo", minHeight: 28 });
      const links = tree.frame({
        name: "Links",
        parentId: row,
        layout: flex("row", { align: "center", gap: 4, wrap: true }),
        style: { size: size(HUG, HUG) },
      });
      setChildren(
        tree,
        links,
        ["Beranda", "Fitur", "Harga", "Kontak"].map((t, i) => link(tree, links, t, i)),
      );
      setChildren(tree, row, [logo, links]);
      setChildren(tree, root, [row, copyright(tree, root)]);
      return [root];
    },
    ["simple"],
  ),

  foot(
    "footer-social",
    "FooterSocial",
    loc("Footer + Media Sosial", "Footer with Socials"),
    loc("Footer dengan tautan dan baris ikon media sosial.", "Footer with links and a row of social media icons."),
    "layout",
    (tree) => {
      const root = footerRoot(tree, "FooterSocial");
      const row = tree.frame({
        name: "Row",
        parentId: root,
        layout: flex("row", { align: "center", justify: "spaceBetween", gap: 6, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      const links = tree.frame({
        name: "Links",
        parentId: row,
        layout: flex("row", { align: "center", gap: 4, wrap: true }),
        style: { size: size(HUG, HUG) },
      });
      setChildren(
        tree,
        links,
        ["Tentang", "Layanan", "Kontak"].map((t, i) => link(tree, links, t, i)),
      );
      const socials = tree.frame({
        name: "Socials",
        parentId: row,
        layout: flex("row", { align: "center", gap: 3 }),
        style: { size: size(HUG, HUG) },
      });
      setChildren(
        tree,
        socials,
        ["instagram", "facebook", "whatsapp", "tiktok"].map((s, i) =>
          tree.icon({
            name: `Social${i + 1}`,
            parentId: socials,
            icon: s,
            set: "brand",
            color: "color.muted",
            sizePx: 22,
          }),
        ),
      );
      setChildren(tree, row, [links, socials]);
      setChildren(tree, root, [row, copyright(tree, root)]);
      return [root];
    },
    ["social"],
  ),

  foot(
    "footer-newsletter",
    "FooterNewsletter",
    loc("Footer + Newsletter", "Footer with Newsletter"),
    loc(
      "Footer dengan form langganan email dan kolom tautan.",
      "Footer with an email subscribe form and link columns.",
    ),
    "layout",
    (tree) => {
      const root = footerRoot(tree, "FooterNewsletter");
      const row = tree.frame({
        name: "Row",
        parentId: root,
        layout: flex("row", { align: "start", justify: "spaceBetween", gap: 8, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      const sub = tree.frame({
        name: "Subscribe",
        parentId: row,
        layout: flex("column", { align: "start", gap: 3 }),
        style: { size: size(FILL, HUG) },
      });
      const subTitle = tree.text({
        name: "SubTitle",
        parentId: sub,
        text: "Langganan info & promo",
        typography: "typography.h4",
        color: "color.onSurface",
        tag: "h4",
        width: FILL,
      });
      const form = tree.frame({
        name: "Form",
        parentId: sub,
        layout: flex("row", { align: "center", gap: 2 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 420, unit: "px" } } },
      });
      setChildren(tree, form, [
        inputBox(tree, form, "Email Anda"),
        button(tree, form, { label: "Kirim", variant: "primary", name: "Submit", sizeStep: 2 }),
      ]);
      setChildren(tree, sub, [subTitle, form]);
      setChildren(tree, row, [sub, linkColumn(tree, row, "Tautan", ["Fitur", "Harga", "Kontak"])]);
      setChildren(tree, root, [row, copyright(tree, root)]);
      return [root];
    },
    ["newsletter"],
  ),

  foot(
    "footer-minimal",
    "FooterMinimal",
    loc("Footer Minimal", "Minimal Footer"),
    loc("Footer satu baris: hak cipta kiri dan tautan kanan.", "A one-line footer: copyright left and links right."),
    "layout",
    (tree) => {
      const root = tree.frame({
        name: "FooterMinimal",
        parentId: "tmp_parent",
        role: "container",
        tag: "footer",
        layout: flex("row", { align: "center", justify: "spaceBetween", gap: 6, padding: padXY(6, 6), wrap: true }),
        style: { size: size(FILL, HUG), fills: [{ type: "solid", color: T("color.surface") }] },
      });
      const cp = copyright(tree, root);
      const links = tree.frame({
        name: "Links",
        parentId: root,
        layout: flex("row", { align: "center", gap: 4 }),
        style: { size: size(HUG, HUG) },
      });
      setChildren(
        tree,
        links,
        ["Privasi", "Syarat", "Kontak"].map((t, i) => link(tree, links, t, i)),
      );
      setChildren(tree, root, [cp, links]);
      return [root];
    },
    ["minimal"],
  ),

  foot(
    "floating-whatsapp",
    "FloatingWhatsApp",
    loc("Tombol WhatsApp Mengambang", "Floating WhatsApp Button"),
    loc(
      "Tombol bulat WhatsApp untuk chat cepat di pojok halaman.",
      "A round WhatsApp button for quick chat in the page corner.",
    ),
    "element",
    (tree) => {
      const btn = tree.frame({
        name: "FloatingWhatsApp",
        parentId: "tmp_parent",
        role: "button",
        layout: flex("row", { align: "center", justify: "center", padding: padAll(4) }),
        style: {
          size: size(HUG, HUG),
          fills: [{ type: "solid", color: T("color.success") }],
          radius: T("radius.full"),
        },
      });
      const icon = tree.icon({
        name: "WaIcon",
        parentId: btn,
        icon: "whatsapp",
        set: "brand",
        color: "color.onPrimary",
        sizePx: 28,
      });
      setChildren(tree, btn, [icon]);
      return [btn];
    },
    ["whatsapp", "floating"],
  ),
];
