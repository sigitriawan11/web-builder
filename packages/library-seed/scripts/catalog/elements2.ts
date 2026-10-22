import {
  type ComponentSpec,
  FILL,
  fixed,
  flex,
  HUG,
  imageBox,
  padAll,
  padXY,
  setChildren,
  size,
  T,
  type Tree,
} from "../builder";

// T3.11.3 — Elements batch 2 (CMP-089): input visual, icon+teks, media (image frame, video lite). kind=element.

const loc = (id: string, en: string) => ({ id, en });
const el = (
  slug: string,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  group: string,
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec => ({
  slug,
  kind: "element",
  categorySlug: "elements",
  name,
  displayName: dn,
  description: desc,
  tags: [group, ...tags],
  keywords: { id: ["elemen", "dasar", group], en: ["element", group] },
  aiHints: "Elemen kecil untuk menyusun section. Gabungkan beberapa untuk membentuk blok.",
  build,
});

function fieldBox(
  tree: Tree,
  parent: string,
  placeholder: string,
  opts: { icon?: string; chevron?: boolean; multiline?: boolean } = {},
): string {
  const box = tree.frame({
    name: "Input",
    parentId: parent,
    layout: flex("row", {
      align: opts.multiline ? "start" : "center",
      justify: "spaceBetween",
      gap: 2,
      padding: padXY(4, opts.multiline ? 4 : 3),
    }),
    style: {
      size: { width: FILL, height: HUG, ...(opts.multiline ? { minHeight: { value: 96, unit: "px" } } : {}) },
      fills: [{ type: "solid", color: T("color.background") }],
      radius: T("radius.md"),
      strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" } }],
    },
  });
  const kids: string[] = [];
  if (opts.icon)
    kids.push(tree.icon({ name: "Lead", parentId: box, icon: opts.icon, color: "color.muted", sizePx: 18 }));
  kids.push(
    tree.text({
      name: "Placeholder",
      parentId: box,
      text: placeholder,
      typography: "typography.body",
      color: "color.muted",
      tag: "span",
      width: FILL,
    }),
  );
  if (opts.chevron)
    kids.push(tree.icon({ name: "Chevron", parentId: box, icon: "chevron-down", color: "color.muted", sizePx: 18 }));
  return setChildren(tree, box, kids);
}
function labeled(tree: Tree, label: string, inner: (parent: string) => string): string[] {
  const col = tree.frame({
    name: "Field",
    parentId: "tmp_parent",
    layout: flex("column", { align: "start", gap: 1 }),
    style: { size: size(FILL, HUG) },
  });
  const lb = tree.text({
    name: "Label",
    parentId: col,
    text: label,
    typography: "typography.overline",
    color: "color.onSurface",
    tag: "label",
    width: FILL,
  });
  const field = inner(col);
  setChildren(tree, col, [lb, field]);
  return [col];
}

export const ELEMENTS2: ComponentSpec[] = [
  // Inputs (visual)
  el(
    "input-text",
    "InputText",
    loc("Input Teks", "Text Input"),
    loc("Kolom isian teks dengan placeholder dan border.", "A text input field with a placeholder and border."),
    "input",
    (tree) => [fieldBox(tree, "tmp_parent", "Ketik di sini…")],
    ["field"],
  ),
  el(
    "input-labeled",
    "InputLabeled",
    loc("Input Berlabel", "Labeled Input"),
    loc("Kolom isian dengan label di atasnya untuk form rapi.", "An input field with a label above it for tidy forms."),
    "input",
    (tree) => labeled(tree, "Nama lengkap", (p) => fieldBox(tree, p, "Mis. Budi Santoso")),
    ["field", "label"],
  ),
  el(
    "input-search",
    "InputSearch",
    loc("Input Pencarian", "Search Input"),
    loc("Kolom pencarian dengan ikon kaca pembesar di kiri.", "A search field with a magnifier icon on the left."),
    "input",
    (tree) => [fieldBox(tree, "tmp_parent", "Cari…", { icon: "search" })],
    ["field", "search"],
  ),
  el(
    "input-textarea",
    "InputTextarea",
    loc("Area Teks", "Textarea"),
    loc(
      "Kolom isian banyak baris untuk pesan atau catatan panjang.",
      "A multi-line input field for messages or longer notes.",
    ),
    "input",
    (tree) => [fieldBox(tree, "tmp_parent", "Tulis pesan Anda…", { multiline: true })],
    ["field", "textarea"],
  ),
  el(
    "input-select",
    "InputSelect",
    loc("Pilihan Dropdown", "Select Field"),
    loc(
      "Kolom pilihan menyerupai dropdown dengan ikon panah bawah.",
      "A select-style field resembling a dropdown with a chevron.",
    ),
    "input",
    (tree) => [fieldBox(tree, "tmp_parent", "Pilih kategori", { chevron: true })],
    ["field", "select"],
  ),
  el(
    "input-checkbox",
    "InputCheckbox",
    loc("Checkbox + Label", "Checkbox + Label"),
    loc("Kotak centang dengan label teks di sampingnya.", "A checkbox with a text label beside it."),
    "input",
    (tree) => {
      const row = tree.frame({
        name: "Checkbox",
        parentId: "tmp_parent",
        layout: flex("row", { align: "center", gap: 2 }),
        style: { size: size(HUG, HUG) },
      });
      const box = tree.frame({
        name: "Box",
        parentId: row,
        role: "generic",
        layout: flex("row", { align: "center", justify: "center" }),
        style: {
          size: { width: fixed(20), height: fixed(20) },
          radius: T("radius.sm"),
          strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" } }],
        },
      });
      const check = tree.icon({ name: "Check", parentId: box, icon: "check", color: "color.primary", sizePx: 14 });
      setChildren(tree, box, [check]);
      const lb = tree.text({
        name: "Label",
        parentId: row,
        text: "Saya setuju dengan syarat & ketentuan",
        typography: "typography.body",
        color: "color.onSurface",
        tag: "label",
        width: HUG,
      });
      setChildren(tree, row, [box, lb]);
      return [row];
    },
    ["checkbox"],
  ),

  // Icon + text
  el(
    "icon-text-row",
    "IconTextRow",
    loc("Ikon + Teks (Baris)", "Icon + Text (Row)"),
    loc(
      "Ikon kecil dengan teks pendek di sampingnya dalam satu baris.",
      "A small icon with short text beside it on a single line.",
    ),
    "icon-text",
    (tree) => {
      const row = tree.frame({
        name: "IconText",
        parentId: "tmp_parent",
        layout: flex("row", { align: "center", gap: 2 }),
        style: { size: size(HUG, HUG) },
      });
      const ic = tree.icon({ name: "Icon", parentId: row, icon: "circle-check", color: "color.primary", sizePx: 20 });
      const tx = tree.text({
        name: "Text",
        parentId: row,
        text: "Gratis ongkir se-Indonesia",
        typography: "typography.body",
        color: "color.onSurface",
        tag: "span",
        width: HUG,
      });
      setChildren(tree, row, [ic, tx]);
      return [row];
    },
    ["list"],
  ),
  el(
    "icon-feature-mini",
    "IconFeatureMini",
    loc("Fitur Mini", "Mini Feature"),
    loc(
      "Ikon di atas judul dan satu baris deskripsi, tersusun vertikal.",
      "An icon above a title and a one-line description, stacked vertically.",
    ),
    "icon-text",
    (tree) => {
      const col = tree.frame({
        name: "Feature",
        parentId: "tmp_parent",
        layout: flex("column", { align: "start", gap: 2 }),
        style: { size: size(FILL, HUG) },
      });
      const ic = tree.icon({ name: "Icon", parentId: col, icon: "zap", color: "color.primary", sizePx: 28 });
      const tt = tree.text({
        name: "Title",
        parentId: col,
        text: "Cepat & ringan",
        typography: "typography.h4",
        color: "color.onSurface",
        tag: "h4",
        width: FILL,
      });
      const dd = tree.text({
        name: "Desc",
        parentId: col,
        text: "Dioptimalkan agar cepat di semua perangkat.",
        typography: "typography.bodySm",
        color: "color.muted",
        tag: "p",
        width: FILL,
      });
      setChildren(tree, col, [ic, tt, dd]);
      return [col];
    },
    ["feature"],
  ),
  el(
    "stat-inline",
    "StatInline",
    loc("Statistik Singkat", "Inline Stat"),
    loc(
      "Angka besar dengan label kecil di bawahnya untuk metrik.",
      "A large number with a small label below it for a metric.",
    ),
    "icon-text",
    (tree) => {
      const col = tree.frame({
        name: "Stat",
        parentId: "tmp_parent",
        layout: flex("column", { align: "start", gap: 0 }),
        style: { size: size(HUG, HUG) },
      });
      const num = tree.text({
        name: "Number",
        parentId: col,
        text: "1.200+",
        typography: "typography.h2",
        color: "color.primary",
        tag: "span",
        width: HUG,
      });
      const lb = tree.text({
        name: "Label",
        parentId: col,
        text: "Pelanggan puas",
        typography: "typography.bodySm",
        color: "color.muted",
        tag: "span",
        width: HUG,
      });
      setChildren(tree, col, [num, lb]);
      return [col];
    },
    ["stat"],
  ),
  el(
    "avatar-name",
    "AvatarName",
    loc("Avatar + Nama", "Avatar + Name"),
    loc("Foto bulat kecil dengan nama dan peran di sampingnya.", "A small round photo with a name and role beside it."),
    "icon-text",
    (tree) => {
      const row = tree.frame({
        name: "Person",
        parentId: "tmp_parent",
        layout: flex("row", { align: "center", gap: 2 }),
        style: { size: size(HUG, HUG) },
      });
      const avatar = tree.frame({
        name: "Avatar",
        parentId: row,
        role: "generic",
        style: {
          size: { width: fixed(44), height: fixed(44) },
          fills: [{ type: "solid", color: T("color.surface") }],
          radius: T("radius.full"),
        },
      });
      const col = tree.frame({
        name: "Text",
        parentId: row,
        layout: flex("column", { align: "start", gap: 0 }),
        style: { size: size(HUG, HUG) },
      });
      const nm = tree.text({
        name: "Name",
        parentId: col,
        text: "Rani Pratama",
        typography: "typography.h4",
        color: "color.onSurface",
        tag: "span",
        width: HUG,
      });
      const rl = tree.text({
        name: "Role",
        parentId: col,
        text: "Pemilik usaha",
        typography: "typography.caption",
        color: "color.muted",
        tag: "span",
        width: HUG,
      });
      setChildren(tree, col, [nm, rl]);
      setChildren(tree, row, [avatar, col]);
      return [row];
    },
    ["avatar"],
  ),

  // Media
  el(
    "media-image-frame",
    "ImageFrame",
    loc("Bingkai Gambar", "Image Frame"),
    loc(
      "Placeholder gambar persegi panjang dengan sudut membulat.",
      "A rectangular image placeholder with rounded corners.",
    ),
    "media",
    (tree) => [imageBox(tree, "tmp_parent", { name: "Image", aspect: 1.5 })],
    ["image"],
  ),
  el(
    "media-image-circle",
    "ImageCircle",
    loc("Gambar Bulat", "Circle Image"),
    loc(
      "Placeholder gambar berbentuk lingkaran untuk avatar atau logo.",
      "A circular image placeholder for an avatar or logo.",
    ),
    "media",
    (tree) => {
      const circle = tree.frame({
        name: "ImageCircle",
        parentId: "tmp_parent",
        role: "generic",
        style: {
          size: { width: fixed(120), height: fixed(120) },
          fills: [{ type: "solid", color: T("color.surface") }],
          radius: T("radius.full"),
        },
      });
      return [circle];
    },
    ["image", "avatar"],
  ),
  el(
    "media-video-lite",
    "VideoLite",
    loc("Video Lite", "Video (Lite)"),
    loc(
      "Placeholder video 16:9 dengan tombol putar di tengah.",
      "A 16:9 video placeholder with a play button in the center.",
    ),
    "media",
    (tree) => {
      const frame = tree.frame({
        name: "Video",
        parentId: "tmp_parent",
        role: "generic",
        layout: flex("row", { align: "center", justify: "center" }),
        style: {
          size: { width: FILL, height: HUG, aspectRatio: 1.7778 },
          fills: [{ type: "solid", color: T("color.surface") }],
          radius: T("radius.lg"),
        },
      });
      const play = tree.icon({
        name: "Play",
        parentId: frame,
        icon: "circle-play",
        color: "color.primary",
        sizePx: 56,
      });
      setChildren(tree, frame, [play]);
      return [frame];
    },
    ["video"],
  ),
  el(
    "media-logo-placeholder",
    "LogoPlaceholder",
    loc("Placeholder Logo", "Logo Placeholder"),
    loc("Kotak logo abu-abu untuk barisan mitra atau klien.", "A grey logo box for a row of partners or clients."),
    "media",
    (tree) => {
      const box = tree.frame({
        name: "Logo",
        parentId: "tmp_parent",
        role: "generic",
        layout: flex("row", { align: "center", justify: "center", padding: padAll(4) }),
        style: {
          size: { width: fixed(140), height: fixed(48) },
          fills: [{ type: "solid", color: T("color.surface") }],
          radius: T("radius.md"),
        },
      });
      const ic = tree.icon({ name: "Mark", parentId: box, icon: "image", color: "color.muted", sizePx: 24 });
      setChildren(tree, box, [ic]);
      return [box];
    },
    ["logo"],
  ),
];
