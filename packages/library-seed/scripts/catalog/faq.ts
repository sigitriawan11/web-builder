import { type ComponentSpec, FILL, flex, HUG, headingGroup, section, setChildren, size, type Tree } from "../builder";

// T3.11.11 (bagian FAQ) — CMP-086: FAQ accordion / daftar tanya-jawab. Interaksi accordion = ED-* (follow-up);
// seed menampilkan semua jawaban (statis).

const loc = (id: string, en: string) => ({ id, en });
const faq = (
  slug: string,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec => ({
  slug,
  kind: "section",
  categorySlug: "faq",
  name,
  displayName: dn,
  description: desc,
  tags: ["faq", ...tags],
  keywords: { id: ["faq", "tanya jawab", "pertanyaan"], en: ["faq", "questions"] },
  aiHints: "4–8 pertanyaan umum calon pelanggan + jawaban singkat & jelas.",
  build,
});

const QA: [string, string][] = [
  ["Apakah saya perlu bisa coding?", "Tidak sama sekali. Cukup pilih template, ubah teks dan gambar, lalu publish."],
  ["Berapa biayanya?", "Anda bisa mulai gratis. Upgrade ke paket berbayar kapan pun Anda butuh fitur lebih."],
  [
    "Bisakah pakai domain sendiri?",
    "Bisa. Hubungkan domain yang sudah Anda miliki atau beli domain baru langsung dari dashboard.",
  ],
  ["Apakah website-nya cepat di HP?", "Ya. Semua template responsif dan dioptimalkan agar cepat di perangkat mobile."],
  ["Bagaimana jika butuh bantuan?", "Tim dukungan kami siap membantu via email dan WhatsApp dalam bahasa Indonesia."],
  ["Apakah ada kontrak jangka panjang?", "Tidak ada. Anda bebas berhenti atau mengganti paket kapan saja."],
];

function qaItem(tree: Tree, parent: string, q: string, a: string): string {
  const item = tree.frame({
    name: "Item",
    parentId: parent,
    layout: flex("column", { align: "start", gap: 1 }),
    style: { size: size(FILL, HUG) },
  });
  const question = tree.text({
    name: "Question",
    parentId: item,
    text: q,
    typography: "typography.h4",
    color: "color.onSurface",
    tag: "h3",
    width: FILL,
  });
  const answer = tree.text({
    name: "Answer",
    parentId: item,
    text: a,
    typography: "typography.body",
    color: "color.muted",
    tag: "p",
    width: FILL,
  });
  return setChildren(tree, item, [question, answer]);
}

export const FAQ: ComponentSpec[] = [
  faq(
    "faq-list",
    "FaqList",
    loc("Daftar FAQ", "FAQ List"),
    loc(
      "Judul dengan daftar pertanyaan dan jawaban satu kolom.",
      "A title with a single-column list of questions and answers.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "FaqList", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, {
        eyebrow: "FAQ",
        heading: "Pertanyaan yang sering diajukan",
        maxTextWidth: 640,
      });
      const list = tree.frame({
        name: "List",
        parentId: inner,
        layout: flex("column", { align: "start", gap: 6 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 760, unit: "px" } } },
      });
      setChildren(
        tree,
        list,
        QA.map(([q, a]) => qaItem(tree, list, q, a)),
      );
      setChildren(tree, inner, [h, list]);
      return [root];
    },
    ["list"],
  ),

  faq(
    "faq-two-column",
    "FaqTwoColumn",
    loc("FAQ Dua Kolom", "Two-column FAQ"),
    loc(
      "Pertanyaan tersusun dalam dua kolom agar lebih ringkas.",
      "Questions arranged in two columns for a compact layout.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "FaqTwoColumn", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, { heading: "Masih ada pertanyaan?", maxTextWidth: 640 });
      const r = tree.frame({
        name: "Columns",
        parentId: inner,
        layout: flex("row", { align: "start", gap: 8, wrap: true }),
        style: { size: size(FILL, HUG) },
      });
      const half = QA.length / 2;
      const mkCol = (items: [string, string][]) => {
        const c = tree.frame({
          name: "Col",
          parentId: r,
          layout: flex("column", { align: "start", gap: 6 }),
          style: { size: size(FILL, HUG) },
        });
        return setChildren(
          tree,
          c,
          items.map(([q, a]) => qaItem(tree, c, q, a)),
        );
      };
      setChildren(tree, r, [mkCol(QA.slice(0, half)), mkCol(QA.slice(half))]);
      setChildren(tree, inner, [h, r]);
      return [root];
    },
    ["two-column"],
  ),

  faq(
    "faq-with-cta",
    "FaqWithCta",
    loc("FAQ + Kontak", "FAQ with Contact"),
    loc("Daftar FAQ ringkas dengan ajakan menghubungi di bawahnya.", "A compact FAQ list with a contact prompt below."),
    (tree) => {
      const { root, inner } = section(tree, { name: "FaqWithCta", padY: 20, gap: 8 });
      const h = headingGroup(tree, inner, { heading: "Hal yang perlu Anda tahu", maxTextWidth: 640 });
      const list = tree.frame({
        name: "List",
        parentId: inner,
        layout: flex("column", { align: "start", gap: 6 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 760, unit: "px" } } },
      });
      setChildren(
        tree,
        list,
        QA.slice(0, 4).map(([q, a]) => qaItem(tree, list, q, a)),
      );
      const note = tree.text({
        name: "Note",
        parentId: inner,
        text: "Tidak menemukan jawaban? Hubungi kami lewat WhatsApp.",
        typography: "typography.body",
        color: "color.primary",
        tag: "p",
        width: FILL,
      });
      setChildren(tree, inner, [h, list, note]);
      return [root];
    },
    ["cta"],
  ),
];
