import type { LengthValue, Node, ResponsiveStyle, SiteDocument, Style } from "../../src";

// T0.8.4 / OPEN-DM-5: 10 section landing UMKM yang umum (navbar, hero, fitur, statistik, logo, CTA,
// testimoni, harga, footer, kontak) untuk menguji deteksi overflow `stackRows` (DM-038) statis vs DOM.
// Beberapa baris sengaja dekat ambang lebar mobile (grup tombol, statistik, baris hak cipta).

const PAGE_ID = "pg_resp000001";
const IMAGE_ASSET = "ast_resp00001";
const px = (value: number): LengthValue => ({ value, unit: "px" });
const pad = (vertical: number, horizontal: number) => ({
  top: px(vertical),
  right: px(horizontal),
  bottom: px(vertical),
  left: px(horizontal),
});

class SectionBuilder {
  readonly nodes: Record<string, Node> = {};
  readonly sections: { id: string; name: string }[] = [];
  private sequence = 0;

  private id(): string {
    this.sequence += 1;
    return `n_rs${this.sequence.toString(36).padStart(6, "0")}`;
  }

  private attach(parentId: string, node: Node): string {
    this.nodes[node.id] = node;
    const parent = this.nodes[parentId];
    if (parent && "children" in parent) parent.children.push(node.id);
    return node.id;
  }

  page(): void {
    this.nodes[PAGE_ID] = {
      id: PAGE_ID,
      type: "page",
      name: "Home",
      parentId: null,
      children: [],
      visible: true,
      locked: false,
      style: { base: { layout: { mode: "flex", direction: "column" }, size: { width: { mode: "fill" } } } },
      props: { path: "/", title: "Home", isHome: true },
    };
  }

  frame(
    parentId: string,
    name: string,
    base: Style,
    extra: { mobile?: ResponsiveStyle["mobile"]; role?: "section" | "card" | "button" | "container" } = {},
  ): string {
    return this.attach(parentId, {
      id: this.id(),
      type: "frame",
      name,
      parentId,
      children: [],
      visible: true,
      locked: false,
      ...(extra.role === "section" ? { tag: "section" as const } : {}),
      style: extra.mobile ? { base, mobile: extra.mobile } : { base },
      props: extra.role ? { role: extra.role } : {},
    });
  }

  section(name: string, base: Style, mobile?: ResponsiveStyle["mobile"]): string {
    const id = this.frame(
      PAGE_ID,
      name,
      { size: { width: { mode: "fill" } }, ...base },
      { role: "section", ...(mobile ? { mobile } : {}) },
    );
    this.sections.push({ id, name });
    return id;
  }

  row(
    parentId: string,
    name: string,
    layout: { gap?: number; justify?: "start" | "spaceBetween" | "spaceAround"; padding?: [number, number] } = {},
    width: "fill" | "hug" = "hug",
  ): string {
    return this.frame(parentId, name, {
      layout: {
        mode: "flex",
        direction: "row",
        align: "center",
        ...(layout.gap !== undefined ? { gap: px(layout.gap) } : {}),
        ...(layout.justify ? { justify: layout.justify } : {}),
        ...(layout.padding ? { padding: pad(...layout.padding) } : {}),
      },
      size: { width: { mode: width } },
    });
  }

  column(
    parentId: string,
    name: string,
    gap: number,
    width: Style["size"] = { width: { mode: "hug" } },
    role?: "card" | "container",
  ): string {
    return this.frame(
      parentId,
      name,
      { layout: { mode: "flex", direction: "column", gap: px(gap) }, size: width },
      role ? { role } : {},
    );
  }

  text(
    parentId: string,
    name: string,
    tag: "h1" | "h2" | "h3" | "p" | "span",
    text: string,
    options: { bold?: boolean; width?: "fill" | "hug" } = {},
  ): string {
    return this.attach(parentId, {
      id: this.id(),
      type: "text",
      name,
      parentId,
      visible: true,
      locked: false,
      tag,
      style: { base: { size: { width: { mode: options.width ?? "hug" } } } },
      props: {
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text, ...(options.bold ? { marks: [{ type: "bold" as const }] } : {}) }],
            },
          ],
        },
      },
    });
  }

  image(parentId: string, name: string, width: number, height: number): string {
    return this.attach(parentId, {
      id: this.id(),
      type: "image",
      name,
      parentId,
      visible: true,
      locked: false,
      style: {
        base: {
          size: {
            width: { mode: "fixed", value: width, unit: "px" },
            height: { mode: "fixed", value: height, unit: "px" },
          },
        },
      },
      props: { image: { assetId: IMAGE_ASSET, alt: name }, fit: "cover" },
    });
  }

  button(parentId: string, label: string): string {
    const button = this.frame(
      parentId,
      `Tombol / ${label}`,
      {
        layout: { mode: "flex", direction: "row", padding: pad(12, 20) },
        size: { width: { mode: "hug" } },
        fills: [{ type: "solid", color: "#E85D2A" }],
      },
      { role: "button" },
    );
    this.text(button, `Tombol / ${label} / Label`, "span", label, { bold: true });
    return button;
  }
}

// Padding horizontal section: 64 px desktop, 16 px mobile (pola umum template).
const sectionLayout = (direction: "row" | "column", gap: number, justify?: "spaceBetween" | "spaceAround"): Style => ({
  layout: {
    mode: "flex",
    direction,
    align: "center",
    gap: px(gap),
    padding: pad(48, 64),
    ...(justify ? { justify } : {}),
  },
});
const MOBILE_PADDING: ResponsiveStyle["mobile"] = { layout: { padding: { left: px(16), right: px(16) } } };

export function responsiveSectionsDocument(): { document: SiteDocument; sections: { id: string; name: string }[] } {
  const b = new SectionBuilder();
  b.page();

  // 1. Navbar: logo + tautan + tombol.
  const nav = b.section("1 Navbar", sectionLayout("row", 32, "spaceBetween"), MOBILE_PADDING);
  b.text(nav, "Logo", "span", "Toko Kue Budi", { bold: true });
  const links = b.row(nav, "Tautan", { gap: 24 });
  for (const label of ["Beranda", "Menu", "Tentang", "Kontak"]) b.text(links, `Tautan / ${label}`, "span", label);
  b.button(nav, "Pesan Sekarang");

  // 2. Hero dua kolom; grup dua tombol di bawah teks (dekat ambang).
  const hero = b.section("2 Hero", sectionLayout("row", 48), MOBILE_PADDING);
  const copy = b.column(hero, "Hero / Teks", 16, { width: { mode: "fill" } });
  b.text(copy, "Hero / Judul", "h1", "Kue Rumahan Segar Setiap Hari");
  b.text(
    copy,
    "Hero / Deskripsi",
    "p",
    "Dibuat dari bahan pilihan tanpa pengawet, dikirim hangat ke rumah Anda di seluruh Bandung.",
    { width: "fill" },
  );
  const ctas = b.row(copy, "Hero / Tombol", { gap: 12 });
  b.button(ctas, "Pesan via WhatsApp");
  b.button(ctas, "Lihat Menu");
  b.image(hero, "Hero / Foto", 480, 360);

  // 3. Fitur tiga kartu.
  const features = b.section("3 Fitur", sectionLayout("row", 24));
  for (const [title, body] of [
    ["Bahan Alami", "Tepung, mentega, dan telur segar dari peternak lokal setiap pagi."],
    ["Antar Cepat", "Pesanan sampai dalam dua jam untuk wilayah kota Bandung."],
    ["Pesan Custom", "Kue ulang tahun dan hampers sesuai tema acara Anda."],
  ] as const) {
    const card = b.column(features, `Fitur / ${title}`, 8, { width: { mode: "fill" } }, "card");
    b.text(card, `Fitur / ${title} / Judul`, "h3", title);
    b.text(card, `Fitur / ${title} / Isi`, "p", body, { width: "fill" });
  }

  // 4. Statistik empat angka pendek (dekat ambang).
  const stats = b.section("4 Statistik", sectionLayout("row", 32, "spaceAround"), MOBILE_PADDING);
  for (const [value, label] of [
    ["10K+", "Pelanggan"],
    ["45", "Varian"],
    ["3", "Kota"],
    ["8", "Tahun"],
  ] as const) {
    const stat = b.column(stats, `Statistik / ${label}`, 4);
    b.text(stat, `Statistik / ${label} / Angka`, "h2", value);
    b.text(stat, `Statistik / ${label} / Label`, "span", label);
  }

  // 5. Deretan logo mitra.
  const logos = b.section("5 Logo mitra", sectionLayout("row", 32), MOBILE_PADDING);
  for (let i = 1; i <= 5; i++) b.image(logos, `Logo ${i}`, 96, 40);

  // 6. Ajakan bertindak.
  const cta = b.section("6 CTA", sectionLayout("row", 24, "spaceBetween"), MOBILE_PADDING);
  b.text(cta, "CTA / Judul", "h2", "Siap memesan untuk acara Anda?");
  b.button(cta, "Hubungi Kami");

  // 7. Testimoni dua kartu.
  const testimonials = b.section("7 Testimoni", sectionLayout("row", 24), MOBILE_PADDING);
  for (const [quote, name] of [
    ["Kuenya lembut dan tidak terlalu manis, keluarga kami suka sekali.", "Rina, Cimahi"],
    ["Pesan hampers lebaran untuk kantor, rapi dan tepat waktu.", "Dodi, Bandung"],
  ] as const) {
    const card = b.column(testimonials, `Testimoni / ${name}`, 12, { width: { mode: "fill" } }, "card");
    b.text(card, `Testimoni / ${name} / Kutipan`, "p", quote, { width: "fill" });
    b.text(card, `Testimoni / ${name} / Nama`, "span", name, { bold: true });
  }

  // 8. Harga: tiga kartu lebar tetap; baris harga kecil di tiap kartu.
  const pricing = b.section("8 Harga", sectionLayout("row", 24), MOBILE_PADDING);
  for (const [plan, price] of [
    ["Hemat", "Rp150rb"],
    ["Keluarga", "Rp275rb"],
    ["Acara", "Rp600rb"],
  ] as const) {
    const card = b.column(pricing, `Harga / ${plan}`, 12, { width: { mode: "fixed", value: 320, unit: "px" } }, "card");
    b.text(card, `Harga / ${plan} / Nama`, "h3", plan);
    const priceRow = b.row(card, `Harga / ${plan} / Baris harga`, { gap: 4 });
    b.text(priceRow, `Harga / ${plan} / Angka`, "h2", price);
    b.text(priceRow, `Harga / ${plan} / Satuan`, "span", "/ paket");
  }

  // 9. Footer: empat kolom tautan + baris hak cipta (dekat ambang).
  const footer = b.section("9 Footer", sectionLayout("column", 32), MOBILE_PADDING);
  const columns = b.row(footer, "Footer / Kolom", { gap: 48 });
  for (const [title, items] of [
    ["Produk", ["Kue Ulang Tahun", "Hampers"]],
    ["Perusahaan", ["Tentang Kami", "Karier"]],
    ["Bantuan", ["Cara Pesan", "Pengiriman"]],
    ["Sosial", ["Instagram", "TikTok"]],
  ] as const) {
    const column = b.column(columns, `Footer / ${title}`, 8);
    b.text(column, `Footer / ${title} / Judul`, "h3", title);
    for (const item of items) b.text(column, `Footer / ${title} / ${item}`, "span", item);
  }
  const bottom = b.row(footer, "Footer / Bawah", { gap: 24, justify: "spaceBetween" }, "fill");
  b.text(bottom, "Footer / Hak cipta", "span", "© 2026 Toko Kue Budi");
  const legal = b.row(bottom, "Footer / Legal", { gap: 16 });
  b.text(legal, "Footer / Privasi", "span", "Privasi");
  b.text(legal, "Footer / Syarat", "span", "Syarat");

  // 10. Kontak: dua tombol kecil + baris ikon & nomor.
  const contact = b.section("10 Kontak", sectionLayout("column", 16), MOBILE_PADDING);
  const contactButtons = b.row(contact, "Kontak / Tombol", { gap: 12 });
  b.button(contactButtons, "WhatsApp");
  b.button(contactButtons, "Telepon");
  const phone = b.row(contact, "Kontak / Telepon", { gap: 8 });
  b.image(phone, "Kontak / Ikon", 24, 24);
  b.text(phone, "Kontak / Nomor", "span", "0812-3456-7890");

  return {
    document: {
      schemaVersion: 1,
      meta: { title: "Uji responsif", createdWith: "template" },
      assets: { [IMAGE_ASSET]: { kind: "image", width: 1200, height: 800, mime: "image/jpeg" } },
      pageOrder: [PAGE_ID],
      nodes: b.nodes,
    },
    sections: b.sections,
  };
}
