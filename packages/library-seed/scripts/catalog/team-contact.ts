import {
  button,
  type ComponentSpec,
  FILL,
  flex,
  HUG,
  headingGroup,
  imageBox,
  inputBox,
  padAll,
  section,
  setChildren,
  size,
  T,
  type Tree,
} from "../builder";

// T3.11.12 — Team/Contact (CMP-087): team grid, contact info, form kontak, map embed. kind=section.

const loc = (id: string, en: string) => ({ id, en });
const tc = (
  categorySlug: "team" | "contact",
  slug: string,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  aiHints: string,
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec => ({
  slug,
  kind: "section",
  categorySlug,
  name,
  displayName: dn,
  description: desc,
  tags,
  keywords:
    categorySlug === "team"
      ? { id: ["tim", "orang", "profil"], en: ["team", "people"] }
      : { id: ["kontak", "alamat", "hubungi"], en: ["contact", "address"] },
  aiHints,
  build,
});

const SOCIALS = ["instagram", "linkedin", "whatsapp"];
function memberCard(tree: Tree, parent: string, name: string, role: string): string {
  const col = tree.frame({
    name: "Member",
    parentId: parent,
    layout: flex("column", { align: "center", gap: 2 }),
    style: { size: size(FILL, HUG) },
  });
  const avatar = imageBox(tree, col, { name: "Avatar", aspect: 1, minHeight: 160 });
  const nm = tree.text({
    name: "Name",
    parentId: col,
    text: name,
    typography: "typography.h4",
    color: "color.onSurface",
    tag: "h3",
    width: FILL,
  });
  const rl = tree.text({
    name: "Role",
    parentId: col,
    text: role,
    typography: "typography.bodySm",
    color: "color.primary",
    tag: "p",
    width: FILL,
  });
  const socials = tree.frame({
    name: "Socials",
    parentId: col,
    layout: flex("row", { align: "center", justify: "center", gap: 2 }),
    style: { size: size(HUG, HUG) },
  });
  setChildren(
    tree,
    socials,
    SOCIALS.map((s, i) =>
      tree.icon({ name: `S${i + 1}`, parentId: socials, icon: s, set: "brand", color: "color.muted", sizePx: 18 }),
    ),
  );
  return setChildren(tree, col, [avatar, nm, rl, socials]);
}
const MEMBERS: [string, string][] = [
  ["Rani Pratama", "Pendiri & CEO"],
  ["Budi Santoso", "Kepala Operasi"],
  ["Sari Dewi", "Pemasaran"],
  ["Agus Wijaya", "Teknologi"],
];

function teamGrid(tree: Tree, name: string, count: number): string[] {
  const { root, inner } = section(tree, { name, padY: 20, gap: 8 });
  const h = headingGroup(tree, inner, {
    eyebrow: "TIM KAMI",
    heading: "Orang-orang di balik layar",
    lead: "Tim kecil yang berdedikasi untuk kesuksesan Anda.",
    maxTextWidth: 640,
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
    MEMBERS.slice(0, count).map(([n, r]) => memberCard(tree, grid, n, r)),
  );
  setChildren(tree, inner, [h, grid]);
  return [root];
}

const CONTACT_ROWS: [string, string, string][] = [
  ["map-pin", "Alamat", "Jl. Merdeka No. 10, Jakarta Pusat"],
  ["phone", "Telepon", "+62 812 3456 7890"],
  ["mail", "Email", "halo@brand.com"],
  ["clock", "Jam Buka", "Senin–Sabtu, 08.00–20.00"],
];
function infoRow(tree: Tree, parent: string, icon: string, label: string, value: string): string {
  const rowN = tree.frame({
    name: "Info",
    parentId: parent,
    layout: flex("row", { align: "start", gap: 3 }),
    style: { size: size(FILL, HUG) },
  });
  const ic = tree.icon({ name: "Icon", parentId: rowN, icon, color: "color.primary", sizePx: 22 });
  const col = tree.frame({
    name: "Text",
    parentId: rowN,
    layout: flex("column", { align: "start", gap: 0 }),
    style: { size: size(FILL, HUG) },
  });
  const lb = tree.text({
    name: "Label",
    parentId: col,
    text: label,
    typography: "typography.overline",
    color: "color.muted",
    tag: "span",
    width: FILL,
  });
  const vl = tree.text({
    name: "Value",
    parentId: col,
    text: value,
    typography: "typography.body",
    color: "color.onSurface",
    tag: "p",
    width: FILL,
  });
  setChildren(tree, col, [lb, vl]);
  return setChildren(tree, rowN, [ic, col]);
}
function infoList(tree: Tree, parent: string): string {
  const list = tree.frame({
    name: "InfoList",
    parentId: parent,
    layout: flex("column", { align: "start", gap: 4 }),
    style: { size: size(FILL, HUG) },
  });
  setChildren(
    tree,
    list,
    CONTACT_ROWS.map(([i, l, v]) => infoRow(tree, list, i, l, v)),
  );
  return list;
}
function contactForm(tree: Tree, parent: string): string {
  const form = tree.frame({
    name: "Form",
    parentId: parent,
    layout: flex("column", { align: "stretch", gap: 3 }),
    style: { size: size(FILL, HUG) },
  });
  const fields = [inputBox(tree, form, "Nama Anda"), inputBox(tree, form, "Email"), inputBox(tree, form, "Pesan")];
  const submit = button(tree, form, { label: "Kirim Pesan", variant: "primary", name: "Submit" });
  return setChildren(tree, form, [...fields, submit]);
}

export const TEAM_CONTACT: ComponentSpec[] = [
  tc(
    "team",
    "team-grid-3",
    "TeamGrid3",
    loc("Tim 3 Orang", "Team (3 people)"),
    loc(
      "Grid tiga anggota tim dengan foto, nama, dan peran.",
      "A grid of three team members with photo, name, and role.",
    ),
    "Tampilkan 3–8 anggota inti: foto, nama, jabatan. Jaga konsisten.",
    (tree) => teamGrid(tree, "TeamGrid3", 3),
    ["team", "grid"],
  ),
  tc(
    "team",
    "team-grid-4",
    "TeamGrid4",
    loc("Tim 4 Orang", "Team (4 people)"),
    loc(
      "Grid empat anggota tim yang membungkus pada layar kecil.",
      "A grid of four team members that wraps on small screens.",
    ),
    "Tampilkan 4+ anggota tim dengan foto dan jabatan jelas.",
    (tree) => teamGrid(tree, "TeamGrid4", 4),
    ["team", "grid"],
  ),
  tc(
    "team",
    "team-member-card",
    "TeamMemberCard",
    loc("Kartu Anggota Tim", "Team Member Card"),
    loc(
      "Satu kartu anggota dengan foto besar, bio, dan ikon sosial.",
      "A single member card with a large photo, bio, and social icons.",
    ),
    "Sorot satu orang penting (pendiri) dengan bio singkat.",
    (tree) => {
      const { root, inner } = section(tree, { name: "TeamMemberCard", padY: 20, gap: 6 });
      const r = tree.frame({
        name: "Row",
        parentId: inner,
        layout: flex("row", { align: "center", gap: 8 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 760, unit: "px" } } },
      });
      const avatar = imageBox(tree, r, { name: "Avatar", aspect: 1, minHeight: 200 });
      const col = tree.frame({
        name: "Bio",
        parentId: r,
        layout: flex("column", { align: "start", gap: 2 }),
        style: { size: size(FILL, HUG) },
      });
      const nm = tree.text({
        name: "Name",
        parentId: col,
        text: "Rani Pratama",
        typography: "typography.h3",
        color: "color.onSurface",
        tag: "h3",
        width: FILL,
      });
      const rl = tree.text({
        name: "Role",
        parentId: col,
        text: "Pendiri & CEO",
        typography: "typography.body",
        color: "color.primary",
        tag: "p",
        width: FILL,
      });
      const bio = tree.text({
        name: "Text",
        parentId: col,
        text: "Membangun brand ini dari nol dengan keyakinan bahwa bisnis kecil pun layak tampil profesional.",
        typography: "typography.body",
        color: "color.muted",
        tag: "p",
        width: FILL,
      });
      const socials = tree.frame({
        name: "Socials",
        parentId: col,
        layout: flex("row", { align: "center", gap: 3 }),
        style: { size: size(HUG, HUG) },
      });
      setChildren(
        tree,
        socials,
        SOCIALS.map((s, i) =>
          tree.icon({ name: `S${i + 1}`, parentId: socials, icon: s, set: "brand", color: "color.muted", sizePx: 20 }),
        ),
      );
      setChildren(tree, col, [nm, rl, bio, socials]);
      setChildren(tree, r, [avatar, col]);
      setChildren(tree, inner, [r]);
      return [root];
    },
    ["team", "card"],
  ),

  tc(
    "contact",
    "contact-info",
    "ContactInfo",
    loc("Info Kontak", "Contact Info"),
    loc(
      "Daftar alamat, telepon, email, dan jam buka dengan ikon.",
      "A list of address, phone, email, and opening hours with icons.",
    ),
    "Tampilkan cara menghubungi: alamat, telepon, email, jam. Pakai ikon.",
    (tree) => {
      const { root, inner } = section(tree, { name: "ContactInfo", padY: 18, gap: 6, align: "start" });
      const h = headingGroup(tree, inner, { align: "start", heading: "Hubungi kami", maxTextWidth: 600 });
      const list = infoList(tree, inner);
      setChildren(tree, inner, [h, list]);
      return [root];
    },
    ["contact", "info"],
  ),

  tc(
    "contact",
    "contact-form",
    "ContactForm",
    loc("Form Kontak", "Contact Form"),
    loc(
      "Form sederhana dengan nama, email, pesan, dan tombol kirim.",
      "A simple form with name, email, message, and a send button.",
    ),
    "Form kontak ringkas: nama, email, pesan. Fungsi kirim via DATA-*.",
    (tree) => {
      const { root, inner } = section(tree, { name: "ContactForm", padY: 18, gap: 6 });
      const h = headingGroup(tree, inner, {
        heading: "Kirim pesan",
        lead: "Kami biasanya membalas dalam 1×24 jam.",
        maxTextWidth: 600,
      });
      const wrap = tree.frame({
        name: "FormWrap",
        parentId: inner,
        layout: flex("column", { align: "stretch" }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 480, unit: "px" } } },
      });
      setChildren(tree, wrap, [contactForm(tree, wrap)]);
      setChildren(tree, inner, [h, wrap]);
      return [root];
    },
    ["contact", "form"],
  ),

  tc(
    "contact",
    "contact-split",
    "ContactSplit",
    loc("Kontak + Form", "Contact + Form"),
    loc(
      "Info kontak di kiri dan form pesan di kanan dalam dua kolom.",
      "Contact info on the left and a message form on the right in two columns.",
    ),
    "Gabungkan info kontak dan form dalam satu section dua kolom.",
    (tree) => {
      const { root, inner } = section(tree, { name: "ContactSplit", padY: 20, gap: 6 });
      const h = headingGroup(tree, inner, { heading: "Mari terhubung", maxTextWidth: 600 });
      const r = tree.frame({
        name: "Row",
        parentId: inner,
        layout: flex("row", { align: "start", gap: 10, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      setChildren(tree, r, [infoList(tree, r), contactForm(tree, r)]);
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["contact", "split"],
  ),

  tc(
    "contact",
    "contact-cards",
    "ContactCards",
    loc("Kartu Kontak", "Contact Cards"),
    loc(
      "Tiga kartu: telepon, email, dan kunjungi — masing-masing dengan ikon.",
      "Three cards: call, email, and visit — each with an icon.",
    ),
    "Tiga cara menghubungi dalam kartu terpisah dengan ikon besar.",
    (tree) => {
      const { root, inner } = section(tree, { name: "ContactCards", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, { heading: "Cara menghubungi kami", maxTextWidth: 600 });
      const grid = tree.frame({
        name: "Grid",
        parentId: inner,
        layout: flex("row", { align: "stretch", justify: "center", gap: 6, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      const cards: [string, string, string][] = [
        ["phone", "Telepon", "+62 812 3456 7890"],
        ["mail", "Email", "halo@brand.com"],
        ["map-pin", "Kunjungi", "Jl. Merdeka No. 10"],
      ];
      setChildren(
        tree,
        grid,
        cards.map(([icon, t, v]) => {
          const c = tree.frame({
            name: "Card",
            parentId: grid,
            role: "card",
            layout: flex("column", { align: "center", gap: 2, padding: padAll(6) }),
            style: {
              size: size(FILL, HUG),
              fills: [{ type: "solid", color: T("color.surface") }],
              radius: T("radius.lg"),
            },
          });
          const ic = tree.icon({ name: "Icon", parentId: c, icon, color: "color.primary", sizePx: 32 });
          const tt = tree.text({
            name: "Title",
            parentId: c,
            text: t,
            typography: "typography.h4",
            color: "color.onSurface",
            tag: "h3",
            width: FILL,
          });
          const vv = tree.text({
            name: "Value",
            parentId: c,
            text: v,
            typography: "typography.bodySm",
            color: "color.muted",
            tag: "p",
            width: FILL,
          });
          return setChildren(tree, c, [ic, tt, vv]);
        }),
      );
      setChildren(tree, inner, [h, grid]);
      return [root];
    },
    ["contact", "cards"],
  ),

  tc(
    "contact",
    "map-embed",
    "MapEmbed",
    loc("Peta + Alamat", "Map + Address"),
    loc(
      "Area peta besar dengan kartu alamat dan tombol arah di atasnya.",
      "A large map area with an address card and directions button over it.",
    ),
    "Sematan peta lokasi + alamat singkat. Peta asli via DATA-*/embed.",
    (tree) => {
      const { root, inner } = section(tree, { name: "MapEmbed", padY: 18, gap: 6 });
      const h = headingGroup(tree, inner, { heading: "Temukan kami", maxTextWidth: 600 });
      const map = tree.frame({
        name: "Map",
        parentId: inner,
        role: "generic",
        layout: flex("row", { align: "center", justify: "center" }),
        style: {
          size: { width: FILL, height: HUG, aspectRatio: 2.4, minHeight: { value: 240, unit: "px" } },
          fills: [{ type: "solid", color: T("color.surface") }],
          radius: T("radius.lg"),
        },
      });
      const pin = tree.icon({ name: "Pin", parentId: map, icon: "map-pin", color: "color.primary", sizePx: 48 });
      setChildren(tree, map, [pin]);
      const addr = tree.frame({
        name: "Address",
        parentId: inner,
        layout: flex("row", { align: "center", justify: "spaceBetween", gap: 4, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      const txt = tree.text({
        name: "Text",
        parentId: addr,
        text: "Jl. Merdeka No. 10, Jakarta Pusat",
        typography: "typography.body",
        color: "color.onSurface",
        tag: "p",
        width: FILL,
      });
      const btn = button(tree, addr, { label: "Buka di Peta", variant: "secondary", name: "Directions", sizeStep: 2 });
      setChildren(tree, addr, [txt, btn]);
      setChildren(tree, inner, [h, map, addr]);
      return [root];
    },
    ["contact", "map"],
  ),
];
