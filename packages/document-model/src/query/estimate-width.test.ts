import { describe, expect, it } from "vitest";
import { responsiveSectionsDocument } from "../../test/fixtures";
import { type LengthValue, type Node, SiteDocumentSchema } from "../schema";
import {
  estimateAvailableWidth,
  estimateMaxContentWidth,
  isStackRowsCandidate,
  rowOverflowsStatic,
  type WidthEstimateContext,
} from "./estimate-width";

const { document, sections } = responsiveSectionsDocument();

// Metrik sederhana agar angka mudah dihitung: 16 px, 0,5 em/karakter (tebal 0,6), h1 32 px.
function context(breakpoint: WidthEstimateContext["breakpoint"] = "mobile"): WidthEstimateContext {
  return {
    nodes: document.nodes,
    assets: document.assets,
    breakpoint,
    lengthPx: (value: LengthValue) => ("$token" in value ? null : value.unit === "px" ? value.value : value.unit === "rem" ? value.value * 16 : null),
    text: { fontSizePx: (node) => (node.tag === "h1" ? 32 : node.tag === "h2" ? 24 : 16), charWidthEm: (bold) => (bold ? 0.6 : 0.5) },
  };
}

function byName(name: string): Node {
  const node = Object.values(document.nodes).find((candidate) => candidate.name === name);
  if (!node) throw new Error(`node "${name}" tidak ada`);
  return node;
}

describe("fixture responsiveSectionsDocument (T0.8.4)", () => {
  it("lolos schema & berisi 10 section", () => {
    expect(SiteDocumentSchema.safeParse(document).success).toBe(true);
    expect(sections).toHaveLength(10);
  });
});

describe("estimateMaxContentWidth (prototipe OPEN-DM-5)", () => {
  it("teks = karakter × font × lebar karakter; tebal lebih lebar", () => {
    expect(estimateMaxContentWidth(byName("Tautan / Menu"), context())).toBe(4 * 16 * 0.5);
    expect(estimateMaxContentWidth(byName("Logo"), context())).toBe(13 * 16 * 0.6);
  });

  it("row = jumlah anak + gap + padding; column = anak terlebar", () => {
    // 4 tautan (7 + 4 + 7 + 6 karakter × 8 px) + 3 gap × 24.
    expect(estimateMaxContentWidth(byName("Tautan"), context())).toBe(24 * 8 + 3 * 24);
    // Kolom statistik: label "Pelanggan" (72) lebih lebar dari angka "10K+" (h2 24 px, heading tebal: 4 × 14,4).
    expect(estimateMaxContentWidth(byName("Statistik / Pelanggan"), context())).toBe(72);
  });

  it("lebar fixed dipakai apa adanya; gambar memakai lebar fixed", () => {
    expect(estimateMaxContentWidth(byName("Harga / Hemat"), context())).toBe(320);
    expect(estimateMaxContentWidth(byName("Logo 1"), context())).toBe(96);
  });

  it("padding mengikuti breakpoint (cascade DM-036)", () => {
    const nav = byName("1 Navbar");
    expect(estimateMaxContentWidth(nav, context("base")) - estimateMaxContentWidth(nav, context("mobile"))).toBe(2 * (64 - 16));
  });

  it("anak tersembunyi & absolute tidak dihitung", () => {
    const links = byName("Tautan");
    const hidden = { ...document.nodes, [byName("Tautan / Kontak").id]: { ...byName("Tautan / Kontak"), visible: false } };
    expect(estimateMaxContentWidth(links, { ...context(), nodes: hidden as typeof document.nodes })).toBe(18 * 8 + 2 * 24);
  });

  it("maxWidth membatasi, minWidth menaikkan", () => {
    const logo = byName("Logo");
    const capped = { ...logo, style: { base: { size: { maxWidth: { value: 50, unit: "px" as const } } } } };
    const raised = { ...logo, style: { base: { size: { minWidth: { value: 300, unit: "px" as const } } } } };
    expect(estimateMaxContentWidth(capped as Node, context())).toBe(50);
    expect(estimateMaxContentWidth(raised as Node, context())).toBe(300);
  });
});

describe("estimateAvailableWidth & rowOverflowsStatic", () => {
  it("lebar tersedia = preview − padding ancestor (mobile 16 + 16)", () => {
    expect(estimateAvailableWidth(byName("Tautan"), 390, context())).toBe(358);
  });

  it("lebar fixed ancestor membatasi ruang", () => {
    // Kartu harga 320 px tanpa padding.
    expect(estimateAvailableWidth(byName("Harga / Hemat / Baris harga"), 390, context())).toBe(320);
  });

  it("kandidat: row non-wrap ≥ 2 anak, bukan tombol", () => {
    expect(isStackRowsCandidate(byName("Tautan"), context())).toBe(true);
    expect(isStackRowsCandidate(byName("Tombol / WhatsApp"), context())).toBe(false);
    expect(isStackRowsCandidate(byName("Fitur / Bahan Alami"), context())).toBe(false);
    expect(isStackRowsCandidate(byName("Logo"), context())).toBe(false);
  });

  it("logo mitra (5 × 96 + 4 × 32) melebihi mobile; tombol kontak muat", () => {
    expect(rowOverflowsStatic(byName("5 Logo mitra"), 390, context())).toBe(true);
    expect(rowOverflowsStatic(byName("Kontak / Tombol"), 390, context())).toBe(false);
  });

  it("margin keamanan menumpuk row yang hampir penuh", () => {
    // Tautan: 264 px dari 358 px tersedia (74%).
    expect(rowOverflowsStatic(byName("Tautan"), 390, context(), 0.9)).toBe(false);
    expect(rowOverflowsStatic(byName("Tautan"), 390, context(), 0.7)).toBe(true);
  });
});
