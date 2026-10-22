import {
  button,
  buttonRow,
  type ComponentSpec,
  FILL,
  flex,
  HUG,
  headingGroup,
  inputBox,
  padAll,
  section,
  setChildren,
  size,
  T,
  type Tree,
} from "../builder";

// T3.11.11 (bagian CTA) — CMP-086: CTA banner, CTA WhatsApp, CTA split, newsletter.

const loc = (id: string, en: string) => ({ id, en });
const cta = (
  slug: string,
  name: string,
  dn: { id: string; en: string },
  desc: { id: string; en: string },
  build: (tree: Tree) => string[],
  tags: string[],
): ComponentSpec => ({
  slug,
  kind: "section",
  categorySlug: "cta",
  name,
  displayName: dn,
  description: desc,
  tags: ["cta", ...tags],
  keywords: { id: ["ajakan", "cta", "daftar"], en: ["cta", "sign up"] },
  aiHints: "Ajakan bertindak di akhir halaman: 1 kalimat kuat + 1 tombol jelas.",
  build,
});

export const CTA: ComponentSpec[] = [
  cta(
    "cta-banner",
    "CtaBanner",
    loc("Banner CTA", "CTA Banner"),
    loc(
      "Banner ajakan terpusat dengan judul dan satu tombol.",
      "Centered call-to-action banner with a title and one button.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "CtaBanner", padY: 20, gap: 5, surface: true });
      const h = headingGroup(tree, inner, {
        heading: "Siap membawa bisnis Anda online?",
        lead: "Mulai gratis, upgrade kapan saja.",
        maxTextWidth: 640,
      });
      const a = buttonRow(tree, inner, [
        button(tree, inner, { label: "Mulai Sekarang", variant: "primary", name: "Cta" }),
      ]);
      setChildren(tree, inner, [h, a]);
      return [root];
    },
    ["banner"],
  ),

  cta(
    "cta-boxed",
    "CtaBoxed",
    loc("CTA Kotak Primer", "Boxed Primary CTA"),
    loc(
      "Kotak berlatar primer dengan judul putih dan tombol sekunder.",
      "A primary-filled box with white title and a secondary button.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "CtaBoxed", padY: 18, gap: 5 });
      const box = tree.frame({
        name: "Box",
        parentId: inner,
        role: "card",
        layout: flex("column", { align: "center", gap: 5, padding: padAll(12) }),
        style: { size: size(FILL, HUG), fills: [{ type: "solid", color: T("color.primary") }], radius: T("radius.xl") },
      });
      const title = tree.text({
        name: "Title",
        parentId: box,
        text: "Jangan tunda lagi — buat website hari ini",
        typography: "typography.h2",
        color: "color.onPrimary",
        tag: "h2",
        width: FILL,
      });
      const lead = tree.text({
        name: "Lead",
        parentId: box,
        text: "Ribuan bisnis sudah online. Giliran Anda.",
        typography: "typography.body",
        color: "color.onPrimary",
        tag: "p",
        width: FILL,
      });
      const btn = button(tree, box, { label: "Coba Gratis", variant: "secondary", name: "Cta" });
      setChildren(tree, box, [title, lead, btn]);
      setChildren(tree, inner, [box]);
      return [root];
    },
    ["boxed"],
  ),

  cta(
    "cta-whatsapp",
    "CtaWhatsApp",
    loc("CTA WhatsApp", "WhatsApp CTA"),
    loc(
      "Ajakan menghubungi via WhatsApp dengan tombol hijau.",
      "Call-to-action to contact via WhatsApp with a green button.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "CtaWhatsApp", padY: 18, gap: 5 });
      const h = headingGroup(tree, inner, {
        heading: "Ada pertanyaan? Chat kami sekarang",
        lead: "Tim kami siap membantu lewat WhatsApp.",
        maxTextWidth: 600,
      });
      const a = buttonRow(tree, inner, [
        button(tree, inner, {
          label: "Chat WhatsApp",
          variant: "whatsapp",
          icon: "whatsapp",
          iconSet: "brand",
          name: "CtaWa",
        }),
      ]);
      setChildren(tree, inner, [h, a]);
      return [root];
    },
    ["whatsapp"],
  ),

  cta(
    "cta-split",
    "CtaSplit",
    loc("CTA Dua Kolom", "Split CTA"),
    loc(
      "Teks ajakan di kiri dan tombol di kanan dalam satu baris.",
      "CTA copy on the left and a button on the right in one row.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "CtaSplit", padY: 18, gap: 5, surface: true });
      const r = tree.frame({
        name: "Row",
        parentId: inner,
        layout: flex("row", { align: "center", justify: "spaceBetween", gap: 6 }),
        style: { size: size(FILL, HUG) },
      });
      const h = headingGroup(tree, r, {
        align: "start",
        heading: "Bangun kehadiran online Anda",
        lead: "Gratis untuk memulai.",
        maxTextWidth: 560,
      });
      const a = buttonRow(tree, r, [button(tree, r, { label: "Mulai", variant: "primary", name: "Cta" })], "start");
      setChildren(tree, r, [h, a]);
      setChildren(tree, inner, [r]);
      return [root];
    },
    ["split"],
  ),

  cta(
    "cta-newsletter",
    "CtaNewsletter",
    loc("CTA Newsletter", "Newsletter CTA"),
    loc(
      "Ajakan berlangganan dengan kolom email dan tombol daftar.",
      "Subscribe call-to-action with an email field and a sign-up button.",
    ),
    (tree) => {
      const { root, inner } = section(tree, { name: "CtaNewsletter", padY: 20, gap: 5 });
      const h = headingGroup(tree, inner, {
        heading: "Dapatkan tips bisnis setiap minggu",
        lead: "Langsung ke email Anda, gratis.",
        maxTextWidth: 600,
      });
      const form = tree.frame({
        name: "Form",
        parentId: inner,
        layout: flex("row", { align: "center", gap: 2 }),
        style: { size: { width: FILL, height: HUG, maxWidth: { value: 520, unit: "px" } } },
      });
      const input = inputBox(tree, form, "Alamat email Anda");
      const btn = button(tree, form, { label: "Berlangganan", variant: "primary", name: "Submit" });
      setChildren(tree, form, [input, btn]);
      setChildren(tree, inner, [h, form]);
      return [root];
    },
    ["newsletter"],
  ),
];
