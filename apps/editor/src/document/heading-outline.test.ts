import { type Node, plainToRichText } from "@platform/document-model";
import { describe, expect, it } from "vitest";
import { analyzeHeadings, collectHeadings } from "./heading-outline";

// Node teks longgar untuk uji analisis (hanya tag + content yang dibaca).
const text = (id: string, tag: string, txt: string, parentId = "pg"): Node =>
  ({
    id,
    type: "text",
    parentId,
    name: txt,
    visible: true,
    locked: false,
    style: { base: {} },
    tag,
    props: { content: plainToRichText(txt) },
  }) as unknown as Node;

const frame = (id: string, children: string[], parentId = "pg"): Node =>
  ({
    id,
    type: "frame",
    parentId,
    name: id,
    visible: true,
    locked: false,
    style: { base: {} },
    children,
    props: {},
  }) as unknown as Node;

const page = (children: string[]): Node =>
  ({
    id: "pg",
    type: "page",
    parentId: null,
    name: "Home",
    visible: true,
    locked: false,
    style: { base: {} },
    props: { title: "Home", path: "/" },
    children,
  }) as unknown as Node;

const doc = (...nodes: Node[]): Record<string, Node> => Object.fromEntries(nodes.map((n) => [n.id, n]));

describe("collectHeadings", () => {
  it("mengumpulkan heading dalam urutan dokumen (DFS), termasuk nested", () => {
    const nodes = doc(
      page(["h1", "sec"]),
      text("h1", "h1", "Judul"),
      frame("sec", ["h2", "para", "h3"]),
      text("h2", "h2", "Bagian", "sec"),
      text("para", "p", "Paragraf biasa", "sec"),
      text("h3", "h3", "Sub", "sec"),
    );
    expect(collectHeadings(nodes, "pg").map((h) => [h.level, h.text])).toEqual([
      [1, "Judul"],
      [2, "Bagian"],
      [3, "Sub"],
    ]);
  });
});

describe("analyzeHeadings (ED-211)", () => {
  it("struktur sehat → tanpa peringatan", () => {
    const nodes = doc(page(["h1", "h2"]), text("h1", "h1", "A"), text("h2", "h2", "B"));
    expect(analyzeHeadings(nodes, "pg").warnings).toEqual([]);
  });

  it("tanpa H1 → peringatan noH1", () => {
    const nodes = doc(page(["h2"]), text("h2", "h2", "B"));
    expect(analyzeHeadings(nodes, "pg").warnings).toContainEqual({ type: "noH1" });
  });

  it("lebih dari satu H1 → multipleH1 untuk H1 berikutnya", () => {
    const nodes = doc(page(["a", "b"]), text("a", "h1", "A"), text("b", "h1", "B"));
    expect(analyzeHeadings(nodes, "pg").warnings).toContainEqual({ type: "multipleH1", nodeId: "b" });
  });

  it("lompatan level (H2 → H4) → levelJump", () => {
    const nodes = doc(page(["h1", "h2", "h4"]), text("h1", "h1", "A"), text("h2", "h2", "B"), text("h4", "h4", "D"));
    expect(analyzeHeadings(nodes, "pg").warnings).toContainEqual({ type: "levelJump", nodeId: "h4", from: 2, to: 4 });
  });
});
