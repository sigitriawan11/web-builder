import {
  type ComponentSpec,
  FILL,
  flex,
  HUG,
  headingGroup,
  imageBox,
  section,
  setChildren,
  size,
  T,
  type Tree,
} from "../builder";

// T3.11.8/T3.11.9 — Content (CMP-084): text block, image+text, galeri, video, about/story, menu, jam operasional.

const loc = (id: string, en: string) => ({ id, en });
const ct = (
  slug: string,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec => ({
  slug,
  kind: "section",
  categorySlug: "content",
  name,
  displayName: dn,
  description: desc,
  tags: ["content", ...tags],
  keywords: { id: ["konten", "teks", "galeri"], en: ["content", "text", "gallery"] },
  aiHints: "Blok konten informatif. Jaga keterbacaan: paragraf pendek, heading jelas.",
  build,
});

const para = (tree: Tree, parent: string, text: string): string =>
  tree.text({
    name: "Paragraph",
    parentId: parent,
    text,
    typography: "typography.body",
    color: "color.onSurface",
    tag: "p",
    width: FILL,
  });
const LOREM =
  "Kami membantu bisnis kecil dan menengah tampil profesional di dunia digital. Dengan alat yang mudah dan desain siap pakai, Anda bisa fokus pada yang terpenting: melayani pelanggan.";

function imageText(tree: Tree, reverse: boolean, heading: string): string[] {
  const { root, inner } = section(tree, { name: reverse ? "ImageTextLeft" : "ImageTextRight", padY: 20, gap: 6 });
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
  const h = headingGroup(tree, textCol, { align: "start", heading, maxTextWidth: 520 });
  const p = para(tree, textCol, LOREM);
  setChildren(tree, textCol, [h, p]);
  const img = imageBox(tree, r, { name: "Image", minHeight: 320 });
  setChildren(tree, r, reverse ? [img, textCol] : [textCol, img]);
  setChildren(tree, inner, [r]);
  return [root];
}

function gallery(tree: Tree, name: string, count: number): string[] {
  const { root, inner } = section(tree, { name, padY: 20, gap: 8 });
  const h = headingGroup(tree, inner, {
    heading: "Galeri",
    lead: "Beberapa karya dan momen terbaik kami.",
    maxTextWidth: 600,
  });
  const grid = tree.frame({
    name: "Grid",
    parentId: inner,
    layout: flex("row", { align: "stretch", justify: "center", gap: 4, wrap: true }),
    style: { size: size(FILL, HUG) },
  });
  setChildren(
    tree,
    grid,
    Array.from({ length: count }, (_, i) => imageBox(tree, grid, { name: `Photo${i + 1}`, aspect: 1 })),
  );
  setChildren(tree, inner, [h, grid]);
  return [root];
}

export const CONTENT: ComponentSpec[] = [
  ct(
    "content-text-block",
    "TextBlock",
    loc("Blok Teks", "Text Block"),
    loc("Judul dengan paragraf teks terpusat untuk penjelasan.", "A title with a centered paragraph for explanation."),
    (tree) => {
      const { root, inner } = section(tree, { name: "TextBlock", padY: 18, gap: 4 });
      const h = headingGroup(tree, inner, { heading: "Tentang layanan kami", maxTextWidth: 680 });
      const wrap = tree.frame({
        name: "Prose",
        parentId: inner,
        layout: flex("column", { align: "center", gap: 3 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 680, unit: "px" } } },
      });
      setChildren(tree, wrap, [
        para(tree, wrap, LOREM),
        para(
          tree,
          wrap,
          "Tim kami berpengalaman membantu ratusan UMKM membangun kehadiran online yang efektif dan terjangkau.",
        ),
      ]);
      setChildren(tree, inner, [h, wrap]);
      return [root];
    },
    ["text"],
  ),

  ct(
    "content-two-column-text",
    "TwoColumnText",
    loc("Teks Dua Kolom", "Two-column Text"),
    loc(
      "Dua kolom paragraf berdampingan untuk konten panjang.",
      "Two side-by-side paragraph columns for longer content.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "TwoColumnText", padY: 18, gap: 6 });
      const h = headingGroup(tree, inner, { heading: "Cerita kami", maxTextWidth: 680 });
      const r = tree.frame({
        name: "Columns",
        parentId: inner,
        layout: flex("row", { align: "start", gap: 8, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      setChildren(tree, r, [
        para(tree, r, LOREM),
        para(
          tree,
          r,
          "Berawal dari satu kedai kecil, kini kami melayani pelanggan di berbagai kota dengan semangat yang sama.",
        ),
      ]);
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["text"],
  ),

  ct(
    "content-image-text-right",
    "ImageTextRight",
    loc("Gambar + Teks (Kanan)", "Image + Text (Right)"),
    loc(
      "Teks di kiri dan gambar di kanan dalam dua kolom.",
      "Text on the left and an image on the right in two columns.",
    ),
    (tree) => imageText(tree, false, "Solusi yang dibuat untuk Anda"),
    ["image-text"],
  ),
  ct(
    "content-image-text-left",
    "ImageTextLeft",
    loc("Gambar + Teks (Kiri)", "Image + Text (Left)"),
    loc("Gambar di kiri dan teks penjelas di kanan.", "An image on the left and explanatory text on the right."),
    (tree) => imageText(tree, true, "Dikerjakan dengan sepenuh hati"),
    ["image-text"],
  ),

  ct(
    "content-gallery-3",
    "Gallery3",
    loc("Galeri 3 Foto", "Gallery (3 photos)"),
    loc("Baris tiga foto persegi untuk menampilkan karya.", "A row of three square photos to showcase work."),
    (tree) => gallery(tree, "Gallery3", 3),
    ["gallery"],
  ),
  ct(
    "content-gallery-grid",
    "GalleryGrid",
    loc("Galeri Grid", "Gallery Grid"),
    loc("Grid enam foto persegi yang membungkus responsif.", "A wrapping grid of six square photos."),
    (tree) => gallery(tree, "GalleryGrid", 6),
    ["gallery"],
  ),

  ct(
    "content-video",
    "VideoEmbed",
    loc("Sematan Video", "Video Embed"),
    loc("Area video besar dengan tombol putar dan keterangan.", "A large video area with a play button and caption."),
    (tree) => {
      const { root, inner } = section(tree, { name: "VideoEmbed", padY: 20, gap: 4 });
      const h = headingGroup(tree, inner, { heading: "Lihat cara kerjanya", maxTextWidth: 600 });
      const frame = tree.frame({
        name: "Video",
        parentId: inner,
        role: "generic",
        layout: flex("row", { align: "center", justify: "center" }),
        style: {
          size: { width: FILL, height: HUG, aspectRatio: 1.7778, maxWidth: { value: 880, unit: "px" } },
          fills: [{ type: "solid", color: T("color.surface") }],
          radius: T("radius.lg"),
        },
      });
      const play = tree.icon({
        name: "Play",
        parentId: frame,
        icon: "circle-play",
        color: "color.primary",
        sizePx: 64,
      });
      setChildren(tree, frame, [play]);
      setChildren(tree, inner, [h, frame]);
      return [root];
    },
    ["video"],
  ),

  ct(
    "content-about-story",
    "AboutStory",
    loc("Tentang / Cerita", "About / Story"),
    loc(
      "Bagian tentang kami dengan gambar dan narasi perjalanan usaha.",
      "An about section with an image and the business's story.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "AboutStory", padY: 20, gap: 6, surface: true });
      const r = tree.frame({
        name: "Row",
        parentId: inner,
        layout: flex("row", { align: "center", gap: 10 }),
        style: { size: size(FILL, HUG) },
      });
      const img = imageBox(tree, r, { name: "Portrait", minHeight: 360 });
      const textCol = tree.frame({
        name: "Text",
        parentId: r,
        layout: flex("column", { align: "start", gap: 4 }),
        style: { size: size(FILL, HUG) },
      });
      const h = headingGroup(tree, textCol, {
        align: "start",
        eyebrow: "CERITA KAMI",
        heading: "Dari dapur rumah ke pelanggan setia",
        maxTextWidth: 520,
      });
      setChildren(tree, textCol, [h, para(tree, textCol, LOREM)]);
      setChildren(tree, r, [img, textCol]);
      setChildren(tree, inner, [r]);
      return [root];
    },
    ["about"],
  ),

  ct(
    "content-menu-list",
    "MenuList",
    loc("Menu / Daftar Harga", "Menu / Price List"),
    loc(
      "Daftar menu restoran dengan nama, deskripsi, dan harga.",
      "A restaurant menu list with name, description, and price.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "MenuList", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        heading: "Menu kami",
        lead: "Dibuat segar setiap hari.",
        maxTextWidth: 600,
      });
      const list = tree.frame({
        name: "Menu",
        parentId: inner,
        layout: flex("column", { align: "stretch", gap: 5 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 720, unit: "px" } } },
      });
      const items: [string, string, string][] = [
        ["Nasi Goreng Spesial", "Dengan telur, ayam, dan kerupuk", "Rp25rb"],
        ["Mie Ayam Bakso", "Mie halus, ayam kecap, bakso sapi", "Rp22rb"],
        ["Es Teh Manis", "Teh segar dengan es batu", "Rp5rb"],
        ["Jus Alpukat", "Alpukat asli tanpa pengawet", "Rp15rb"],
      ];
      setChildren(
        tree,
        list,
        items.map(([n, d, p]) => {
          const rowN = tree.frame({
            name: "Item",
            parentId: list,
            layout: flex("row", { align: "start", justify: "spaceBetween", gap: 4 }),
            style: { size: size(FILL, HUG) },
          });
          const left = tree.frame({
            name: "Info",
            parentId: rowN,
            layout: flex("column", { align: "start", gap: 1 }),
            style: { size: size(FILL, HUG) },
          });
          const nm = tree.text({
            name: "Name",
            parentId: left,
            text: n,
            typography: "typography.h4",
            color: "color.onSurface",
            tag: "h4",
            width: FILL,
          });
          const ds = tree.text({
            name: "Desc",
            parentId: left,
            text: d,
            typography: "typography.bodySm",
            color: "color.muted",
            tag: "p",
            width: FILL,
          });
          setChildren(tree, left, [nm, ds]);
          const price = tree.text({
            name: "Price",
            parentId: rowN,
            text: p,
            typography: "typography.h4",
            color: "color.primary",
            tag: "span",
            width: HUG,
          });
          return setChildren(tree, rowN, [left, price]);
        }),
      );
      setChildren(tree, inner, [h, list]);
      return [root];
    },
    ["menu"],
  ),

  ct(
    "content-hours",
    "OpeningHours",
    loc("Jam Operasional", "Opening Hours"),
    loc(
      "Tabel jam buka per hari untuk informasi pelanggan.",
      "A per-day opening hours table for customer information.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "OpeningHours", padY: 18, gap: 6 });
      const h = headingGroup(tree, inner, { heading: "Jam operasional", maxTextWidth: 600 });
      const list = tree.frame({
        name: "Hours",
        parentId: inner,
        layout: flex("column", { align: "stretch", gap: 2 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 480, unit: "px" } } },
      });
      const rows: [string, string][] = [
        ["Senin – Jumat", "08.00 – 21.00"],
        ["Sabtu", "09.00 – 22.00"],
        ["Minggu", "10.00 – 20.00"],
        ["Hari Libur", "Tutup"],
      ];
      setChildren(
        tree,
        list,
        rows.map(([d, t]) => {
          const rowN = tree.frame({
            name: "Row",
            parentId: list,
            layout: flex("row", { align: "center", justify: "spaceBetween", gap: 4 }),
            style: { size: size(FILL, HUG) },
          });
          const day = tree.text({
            name: "Day",
            parentId: rowN,
            text: d,
            typography: "typography.body",
            color: "color.onSurface",
            tag: "span",
            width: FILL,
          });
          const time = tree.text({
            name: "Time",
            parentId: rowN,
            text: t,
            typography: "typography.body",
            color: "color.muted",
            tag: "span",
            width: HUG,
          });
          return setChildren(tree, rowN, [day, time]);
        }),
      );
      setChildren(tree, inner, [h, list]);
      return [root];
    },
    ["hours"],
  ),

  ct(
    "content-rich-prose",
    "RichProse",
    loc("Artikel / Prosa", "Article / Prose"),
    loc(
      "Judul besar dengan beberapa paragraf untuk artikel blog.",
      "A large title with several paragraphs for a blog article.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "RichProse", padY: 18, gap: 4, align: "start" });
      const h = headingGroup(tree, inner, {
        align: "start",
        heading: "5 tips agar website Anda lebih menjual",
        maxTextWidth: 720,
      });
      const wrap = tree.frame({
        name: "Prose",
        parentId: inner,
        layout: flex("column", { align: "start", gap: 3 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 720, unit: "px" } } },
      });
      setChildren(tree, wrap, [
        para(tree, wrap, LOREM),
        para(
          tree,
          wrap,
          "Pertama, pastikan halaman memuat cepat. Kedua, gunakan foto berkualitas. Ketiga, tampilkan testimoni pelanggan.",
        ),
        para(
          tree,
          wrap,
          "Keempat, permudah cara menghubungi Anda. Kelima, perbarui konten secara berkala agar tetap relevan.",
        ),
      ]);
      setChildren(tree, inner, [h, wrap]);
      return [root];
    },
    ["text", "blog"],
  ),

  ct(
    "content-highlight-box",
    "HighlightBox",
    loc("Kotak Sorotan", "Highlight Box"),
    loc(
      "Kotak surface berisi judul dan teks penting yang disorot.",
      "A surface box containing a highlighted title and important text.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "HighlightBox", padY: 18, gap: 4 });
      const box = tree.frame({
        name: "Box",
        parentId: inner,
        role: "card",
        layout: flex("column", { align: "start", gap: 2 }),
        style: {
          size: size(FILL, HUG),
          fills: [{ type: "solid", color: T("color.surface") }],
          radius: T("radius.lg"),
          strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" } }],
        },
      });
      const title = tree.text({
        name: "Title",
        parentId: box,
        text: "Catatan penting",
        typography: "typography.h4",
        color: "color.onSurface",
        tag: "h4",
        width: FILL,
      });
      const text = para(tree, box, "Pastikan data kontak selalu terbaru agar pelanggan mudah menjangkau Anda.");
      setChildren(tree, box, [title, text]);
      setChildren(tree, inner, [box]);
      return [root];
    },
    ["highlight"],
  ),

  ct(
    "content-logos-text",
    "ContentLogos",
    loc("Teks + Logo Klien", "Text + Client Logos"),
    loc(
      "Paragraf singkat dengan barisan logo klien di bawahnya.",
      "A short paragraph with a row of client logos below.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "ContentLogos", padY: 18, gap: 6 });
      const h = headingGroup(tree, inner, { heading: "Mitra yang mempercayai kami", maxTextWidth: 600 });
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
      setChildren(tree, inner, [h, logos]);
      return [root];
    },
    ["logos"],
  ),

  ct(
    "content-story-timeline",
    "StoryTimeline",
    loc("Perjalanan / Lini Masa", "Story / Timeline"),
    loc(
      "Lini masa perjalanan usaha dengan tahun dan tonggak penting.",
      "A timeline of the business journey with years and key milestones.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "StoryTimeline", padY: 20, gap: 8, align: "start" });
      const h = headingGroup(tree, inner, {
        align: "start",
        eyebrow: "PERJALANAN KAMI",
        heading: "Tumbuh bersama pelanggan",
        maxTextWidth: 600,
      });
      const list = tree.frame({
        name: "Timeline",
        parentId: inner,
        layout: flex("column", { align: "start", gap: 5 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 680, unit: "px" } } },
      });
      const steps: [string, string, string][] = [
        ["2021", "Awal mula", "Dimulai dari satu kedai kecil dengan satu menu andalan."],
        ["2023", "Buka cabang", "Membuka tiga cabang baru dan mulai layanan antar."],
        ["2026", "Hadir online", "Kini melayani pemesanan daring ke seluruh kota."],
      ];
      setChildren(
        tree,
        list,
        steps.map(([y, t, d]) => {
          const rowN = tree.frame({
            name: "Milestone",
            parentId: list,
            layout: flex("row", { align: "start", gap: 5 }),
            style: { size: size(FILL, HUG) },
          });
          const year = tree.text({
            name: "Year",
            parentId: rowN,
            text: y,
            typography: "typography.h3",
            color: "color.primary",
            tag: "span",
            width: HUG,
          });
          const col = tree.frame({
            name: "Info",
            parentId: rowN,
            layout: flex("column", { align: "start", gap: 1 }),
            style: { size: size(FILL, HUG) },
          });
          const t1 = tree.text({
            name: "Title",
            parentId: col,
            text: t,
            typography: "typography.h4",
            color: "color.onSurface",
            tag: "h4",
            width: FILL,
          });
          const d1 = tree.text({
            name: "Desc",
            parentId: col,
            text: d,
            typography: "typography.body",
            color: "color.muted",
            tag: "p",
            width: FILL,
          });
          setChildren(tree, col, [t1, d1]);
          return setChildren(tree, rowN, [year, col]);
        }),
      );
      setChildren(tree, inner, [h, list]);
      return [root];
    },
    ["about", "story"],
  ),

  ct(
    "content-price-list",
    "ServicePriceList",
    loc("Daftar Harga Jasa", "Service Price List"),
    loc(
      "Daftar layanan beserta harga dalam satu kolom rapi.",
      "A tidy single-column list of services with their prices.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "PriceList", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        heading: "Daftar harga layanan",
        lead: "Harga jelas, tanpa biaya tersembunyi.",
        maxTextWidth: 600,
      });
      const list = tree.frame({
        name: "Prices",
        parentId: inner,
        layout: flex("column", { align: "stretch", gap: 4 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 680, unit: "px" } } },
      });
      const items: [string, string][] = [
        ["Potong rambut dewasa", "Rp45rb"],
        ["Potong + keramas", "Rp65rb"],
        ["Cat rambut", "mulai Rp150rb"],
        ["Perawatan wajah", "Rp120rb"],
      ];
      setChildren(
        tree,
        list,
        items.map(([n, p]) => {
          const rowN = tree.frame({
            name: "Row",
            parentId: list,
            layout: flex("row", { align: "center", justify: "spaceBetween", gap: 4 }),
            style: {
              size: size(FILL, HUG),
              strokes: [{ color: T("color.border"), width: { value: 1, unit: "px" }, sides: { bottom: true } }],
            },
          });
          const nm = tree.text({
            name: "Name",
            parentId: rowN,
            text: n,
            typography: "typography.body",
            color: "color.onSurface",
            tag: "span",
            width: FILL,
          });
          const pr = tree.text({
            name: "Price",
            parentId: rowN,
            text: p,
            typography: "typography.body",
            color: "color.primary",
            tag: "span",
            width: HUG,
          });
          return setChildren(tree, rowN, [nm, pr]);
        }),
      );
      setChildren(tree, inner, [h, list]);
      return [root];
    },
    ["menu", "price"],
  ),

  ct(
    "content-schedule",
    "WeeklySchedule",
    loc("Jadwal Mingguan", "Weekly Schedule"),
    loc(
      "Jadwal kegiatan atau kelas per hari dalam bentuk daftar.",
      "A per-day list of activities or classes for the week.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "WeeklySchedule", padY: 18, gap: 6 });
      const h = headingGroup(tree, inner, { heading: "Jadwal kelas", maxTextWidth: 600 });
      const list = tree.frame({
        name: "Schedule",
        parentId: inner,
        layout: flex("column", { align: "stretch", gap: 2 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 560, unit: "px" } } },
      });
      const rows: [string, string][] = [
        ["Senin", "Yoga pagi · 07.00"],
        ["Rabu", "Pilates · 18.00"],
        ["Jumat", "Zumba · 19.00"],
        ["Sabtu", "Kelas pemula · 09.00"],
      ];
      setChildren(
        tree,
        list,
        rows.map(([d, t]) => {
          const rowN = tree.frame({
            name: "Row",
            parentId: list,
            layout: flex("row", { align: "center", justify: "spaceBetween", gap: 4 }),
            style: { size: size(FILL, HUG) },
          });
          const day = tree.text({
            name: "Day",
            parentId: rowN,
            text: d,
            typography: "typography.h4",
            color: "color.onSurface",
            tag: "span",
            width: HUG,
          });
          const act = tree.text({
            name: "Activity",
            parentId: rowN,
            text: t,
            typography: "typography.body",
            color: "color.muted",
            tag: "span",
            width: FILL,
          });
          return setChildren(tree, rowN, [day, act]);
        }),
      );
      setChildren(tree, inner, [h, list]);
      return [root];
    },
    ["hours", "schedule"],
  ),
];
