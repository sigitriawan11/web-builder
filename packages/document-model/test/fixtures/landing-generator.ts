import type { Node, ResponsiveStyle, SiteDocument } from "../../src";
import { defaultSiteSettings, emptyTheme } from "../../src/defaults/top-level";

// Generator halaman landing realistis untuk benchmark canvas (ED-022, T0.2.4).
// Deterministik (PRNG ber-seed) agar hasil benchmark antar run bisa dibandingkan.

export interface LandingOptions {
  // Jumlah node persis, termasuk node page.
  nodeCount: number;
  seed?: number;
}

const PAGE_ID = "pg_bench00001";
const ASSET_IDS = ["ast_ph0000001", "ast_ph0000002", "ast_ph0000003", "ast_ph0000004", "ast_ph0000005"];

// Biaya node per blok; dipakai untuk memastikan blok hanya dibuat jika budget cukup.
const COST = { nav: 7, hero: 8, sectionShell: 5, card: 6 } as const;

const WORDS = (
  "kue roti cokelat keju segar rumahan pesan antar gratis ongkir promo spesial harga hemat kualitas terbaik " +
  "bahan alami tanpa pengawet resep keluarga sejak tahun pelanggan setia rasa lezat manis gurih hangat " +
  "layanan cepat ramah mudah aman praktis bandung jakarta surabaya hari ini minggu bulan paket hampers"
).split(" ");

// mulberry32: PRNG kecil & cepat, cukup untuk data uji.
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class LandingBuilder {
  readonly nodes: Record<string, Node> = {};
  private readonly children = new Map<string, string[]>();
  private sequence = 0;
  remaining: number;

  constructor(
    nodeCount: number,
    private readonly rng: () => number,
  ) {
    this.remaining = nodeCount;
  }

  private nextId(): string {
    this.sequence += 1;
    return `n_${this.sequence.toString(36).padStart(8, "0")}`;
  }

  private int(min: number, max: number): number {
    return min + Math.floor(this.rng() * (max - min + 1));
  }

  sentence(minWords: number, maxWords: number): string {
    const words = Array.from({ length: this.int(minWords, maxWords) }, () => WORDS[this.int(0, WORDS.length - 1)]);
    const text = words.join(" ");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private add(node: Node): string {
    this.nodes[node.id] = node;
    if ("children" in node) this.children.set(node.id, node.children);
    if (node.parentId) this.children.get(node.parentId)?.push(node.id);
    this.remaining -= 1;
    return node.id;
  }

  page(): string {
    return this.add({
      id: PAGE_ID,
      type: "page",
      name: "Home",
      parentId: null,
      children: [],
      visible: true,
      locked: false,
      style: { base: { layout: { mode: "flex", direction: "column" }, size: { width: { mode: "fill" } } } },
      props: { path: "/", title: "Home", isHome: true },
    });
  }

  frame(
    parentId: string,
    name: string,
    style: ResponsiveStyle,
    extra: {
      tag?: "section" | "header" | "nav" | "div";
      role?: "section" | "container" | "card" | "button" | "list";
    } = {},
  ): string {
    return this.add({
      id: this.nextId(),
      type: "frame",
      name,
      parentId,
      children: [],
      visible: true,
      locked: false,
      ...(extra.tag ? { tag: extra.tag } : {}),
      style,
      props: extra.role ? { role: extra.role } : {},
    });
  }

  text(
    parentId: string,
    name: string,
    tag: "h1" | "h2" | "h3" | "p" | "span",
    text: string,
    width: "fill" | "hug" = "fill",
  ): string {
    return this.add({
      id: this.nextId(),
      type: "text",
      name,
      parentId,
      visible: true,
      locked: false,
      tag,
      style: { base: { size: { width: { mode: width }, height: { mode: "hug" } } } },
      props: {
        autoSize: width === "hug" ? "width" : "height",
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
      },
    });
  }

  image(parentId: string, name: string, height: number): string {
    return this.add({
      id: this.nextId(),
      type: "image",
      name,
      parentId,
      visible: true,
      locked: false,
      style: {
        base: {
          size: { width: { mode: "fill" }, height: { mode: "fixed", value: height, unit: "px" } },
          radius: { $token: "radius.md" },
        },
      },
      props: {
        fit: "cover",
        image: { assetId: ASSET_IDS[this.int(0, ASSET_IDS.length - 1)] ?? "ast_ph0000001", alt: this.sentence(3, 6) },
      },
    });
  }

  button(parentId: string, label: string): void {
    const button = this.frame(
      parentId,
      "Button",
      {
        base: {
          layout: {
            mode: "flex",
            direction: "row",
            align: "center",
            justify: "center",
            padding: {
              top: { $token: "space.2" },
              right: { $token: "space.4" },
              bottom: { $token: "space.2" },
              left: { $token: "space.4" },
            },
          },
          size: { width: { mode: "hug" }, height: { mode: "hug" } },
          fills: [{ type: "solid", color: { $token: "color.primary" } }],
          radius: { $token: "radius.full" },
        },
      },
      { role: "button" },
    );
    this.text(button, "Button / Label", "span", label, "hug");
  }

  nav(pageId: string): void {
    const header = this.frame(
      pageId,
      "Navbar",
      {
        base: {
          layout: {
            mode: "flex",
            direction: "row",
            justify: "spaceBetween",
            align: "center",
            padding: { top: { $token: "space.4" }, bottom: { $token: "space.4" } },
          },
          size: { width: { mode: "fill" }, height: { mode: "hug" } },
          fills: [{ type: "solid", color: "#FFFFFF" }],
        },
      },
      { tag: "header" },
    );
    this.text(header, "Navbar / Logo", "span", "Toko Kue", "hug");
    const links = this.frame(
      header,
      "Navbar / Links",
      {
        base: { layout: { mode: "flex", direction: "row", gap: { $token: "space.6" } } },
        mobile: { layout: { gap: { $token: "space.3" } } },
      },
      { tag: "nav" },
    );
    for (const label of ["Beranda", "Menu", "Tentang", "Kontak"])
      this.text(links, `Link / ${label}`, "span", label, "hug");
  }

  hero(pageId: string): void {
    const section = this.frame(pageId, "Hero", this.sectionStyle("#FFF8F0"), { tag: "section", role: "section" });
    const row = this.frame(section, "Hero / Row", {
      base: {
        layout: { mode: "flex", direction: "row", gap: { $token: "space.10" }, align: "center" },
        size: { width: { mode: "fill" } },
      },
      mobile: { layout: { direction: "column" } },
    });
    const copy = this.frame(row, "Hero / Copy", {
      base: {
        layout: { mode: "flex", direction: "column", gap: { $token: "space.4" } },
        size: { width: { mode: "fill" } },
      },
    });
    this.text(copy, "Hero / Title", "h1", this.sentence(4, 8));
    this.text(copy, "Hero / Subtitle", "p", this.sentence(12, 24));
    this.button(copy, "Pesan sekarang");
    this.image(row, "Hero / Photo", 420);
  }

  featureSection(pageId: string, index: number): string {
    const section = this.frame(pageId, `Fitur ${index}`, this.sectionStyle(index % 2 === 0 ? "#FFFFFF" : "#F7F3EE"), {
      tag: "section",
      role: "section",
    });
    const container = this.frame(
      section,
      `Fitur ${index} / Container`,
      {
        base: {
          layout: { mode: "flex", direction: "column", gap: { $token: "space.6" }, align: "center" },
          size: { width: { mode: "fill" }, maxWidth: { $token: "size.container" } },
        },
      },
      { role: "container" },
    );
    this.text(container, `Fitur ${index} / Judul`, "h2", this.sentence(3, 7));
    this.text(container, `Fitur ${index} / Deskripsi`, "p", this.sentence(10, 30));
    return this.frame(
      container,
      `Fitur ${index} / Grid`,
      {
        base: {
          layout: {
            mode: "flex",
            direction: "row",
            wrap: true,
            gap: { $token: "space.6" },
            crossGap: { $token: "space.6" },
            justify: "center",
          },
          size: { width: { mode: "fill" } },
        },
        mobile: { layout: { direction: "column" } },
      },
      { role: "list" },
    );
  }

  card(gridId: string, index: number): void {
    const card = this.frame(
      gridId,
      `Kartu ${index}`,
      {
        base: {
          layout: {
            mode: "flex",
            direction: "column",
            gap: { $token: "space.3" },
            padding: {
              top: { $token: "space.4" },
              right: { $token: "space.4" },
              bottom: { $token: "space.4" },
              left: { $token: "space.4" },
            },
          },
          size: { width: { mode: "fixed", value: 280, unit: "px" }, height: { mode: "hug" } },
          fills: [{ type: "solid", color: "#FFFFFF" }],
          radius: { $token: "radius.lg" },
        },
        mobile: { size: { width: { mode: "fill" } } },
      },
      { role: "card" },
    );
    this.image(card, `Kartu ${index} / Foto`, 180);
    this.text(card, `Kartu ${index} / Judul`, "h3", this.sentence(2, 5));
    this.text(card, `Kartu ${index} / Deskripsi`, "p", this.sentence(8, 20));
    this.button(card, "Lihat detail");
  }

  cardsPerSection(): number {
    return this.int(3, 12);
  }

  private sectionStyle(fill: string): ResponsiveStyle {
    return {
      base: {
        layout: {
          mode: "flex",
          direction: "column",
          gap: { $token: "space.8" },
          align: "center",
          padding: {
            top: { $token: "space.16" },
            right: { $token: "space.8" },
            bottom: { $token: "space.16" },
            left: { $token: "space.8" },
          },
        },
        size: { width: { mode: "fill" }, height: { mode: "hug" } },
        fills: [{ type: "solid", color: fill }],
      },
      mobile: { layout: { padding: { top: { $token: "space.10" }, bottom: { $token: "space.10" } } } },
    };
  }
}

export function generateLandingDocument({ nodeCount, seed = 1 }: LandingOptions): SiteDocument {
  if (!Number.isInteger(nodeCount) || nodeCount < 1) {
    throw new Error(`nodeCount harus bilangan bulat ≥ 1, didapat ${nodeCount}`);
  }
  const builder = new LandingBuilder(nodeCount, createRng(seed));
  const pageId = builder.page();
  // Sisa budget yang tidak cukup untuk satu blok diisi teks di sini agar total node tepat.
  let fillerParent = pageId;

  if (builder.remaining >= COST.nav) builder.nav(pageId);
  if (builder.remaining >= COST.hero) builder.hero(pageId);

  for (let section = 1; builder.remaining >= COST.sectionShell + COST.card; section++) {
    const gridId = builder.featureSection(pageId, section);
    fillerParent = gridId;
    const cards = builder.cardsPerSection();
    for (let card = 1; card <= cards && builder.remaining >= COST.card; card++) builder.card(gridId, card);
  }

  while (builder.remaining > 0) builder.text(fillerParent, "Catatan", "p", builder.sentence(4, 12));

  return {
    schemaVersion: 1,
    meta: { title: `Benchmark Landing ${nodeCount}`, createdWith: "template" },
    settings: defaultSiteSettings({ title: `Benchmark Landing ${nodeCount}` }),
    theme: emptyTheme(),
    componentDeps: {},
    assets: Object.fromEntries(
      ASSET_IDS.map((id) => [id, { kind: "image" as const, width: 1200, height: 800, mime: "image/jpeg" }]),
    ),
    pageOrder: [PAGE_ID],
    nodes: builder.nodes,
  };
}

export const landing200 = (): SiteDocument => generateLandingDocument({ nodeCount: 200 });
export const landing2000 = (): SiteDocument => generateLandingDocument({ nodeCount: 2000 });
