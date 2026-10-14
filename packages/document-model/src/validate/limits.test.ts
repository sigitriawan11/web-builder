import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { heroDocument, minimalDocument } from "../../test/fixtures/basic-documents";
import { runCommand } from "../commands/command";
import { createNode } from "../commands/create-node";
import { moveNode } from "../commands/move-node";
import { checkByteLimit, checkLimit, DOCUMENT_LIMITS } from "../limits";
import type { Node, SiteDocument } from "../schema";
import { validateDocument } from "./validate-document";

// T1.8.15: batas dokumen DM-076 — validator (hard = LIMITS, soft = LIMIT_WARNING) & command (LIMIT_EXCEEDED).
const HOME = "pg_home000001";
const pad = (n: number) => String(n).padStart(8, "0");

const textNode = (id: string, parentId: string, text = "x"): Node => ({
  id,
  type: "text",
  name: id,
  parentId,
  visible: true,
  locked: false,
  style: { base: {} },
  props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] } },
});

const frameNode = (id: string, parentId: string, children: string[]): Node => ({
  id,
  type: "frame",
  name: id,
  parentId,
  children,
  visible: true,
  locked: false,
  style: { base: { layout: { mode: "flex", direction: "column" } } },
  props: {},
});

/** Page home berisi `frames` frame, masing-masing `perFrame` teks. */
function bulkDocument(frames: number, perFrame: number): SiteDocument {
  const doc = minimalDocument();
  const page = doc.nodes[HOME];
  if (page?.type !== "page") throw new Error("fixture berubah");
  for (let f = 0; f < frames; f++) {
    const frameId = `n_f${pad(f)}`;
    const children = Array.from({ length: perFrame }, (_, t) => `n_t${pad(f * 1000 + t)}`);
    doc.nodes[frameId] = frameNode(frameId, HOME, children);
    for (const id of children) doc.nodes[id] = textNode(id, frameId);
    page.children.push(frameId);
  }
  return doc;
}

/** Rantai frame bersarang sedalam `depth` di bawah page; kembalikan ID terdalam. */
function deepDocument(depth: number): { doc: SiteDocument; deepest: string } {
  const doc = minimalDocument();
  let parent = HOME;
  for (let level = 1; level <= depth; level++) {
    const id = `n_d${pad(level)}`;
    doc.nodes[id] = frameNode(id, parent, []);
    const parentNode = doc.nodes[parent];
    if (parentNode && "children" in parentNode) parentNode.children.push(id);
    parent = id;
  }
  return { doc, deepest: parent };
}

const limitIssues = (doc: SiteDocument, code: "LIMITS" | "LIMIT_WARNING") => {
  const result = validateDocument(doc, { mode: "edit" });
  return [...result.errors, ...result.warnings]
    .filter((issue) => issue.code === code)
    .map((issue) => issue.details?.limit);
};

describe("checkLimit", () => {
  it("null di bawah soft, soft di antara, hard di atas batas hard", () => {
    expect(checkLimit("nodesPerPage", 2_000)).toBeNull();
    expect(checkLimit("nodesPerPage", 2_001)).toMatchObject({ level: "soft", max: 2_000 });
    expect(checkLimit("nodesPerPage", 5_001)).toMatchObject({ level: "hard", max: 5_000 });
    expect(checkLimit("childrenPerContainer", 500)).toBeNull();
    expect(checkByteLimit("yDocStateBytes", 16 * 1024 * 1024 + 1)).toMatchObject({
      level: "hard",
      limit: "yDocStateBytes",
    });
    expect(checkByteLimit("jsonSnapshotBytes", 7 * 1024 * 1024)).toMatchObject({ level: "soft" });
  });
});

describe("validator (DM-076)", () => {
  it("anak per container > 500 → LIMITS informatif (nama batas, nilai, maks)", () => {
    const result = validateDocument(bulkDocument(1, 501), { mode: "edit" });
    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual({
      code: "LIMITS",
      path: ["nodes", "n_f00000000", "children"],
      nodeId: "n_f00000000",
      message: {
        id: "Batas anak per container terlampaui: 501 (maks 500)",
        en: "Limit exceeded for children per container: 501 (max 500)",
      },
      details: { limit: "childrenPerContainer", value: 501, max: 500 },
    });
    expect(validateDocument(bulkDocument(1, 500), { mode: "publish" }).ok).toBe(true);
  });

  it("node per page: > 2.000 warning, > 5.000 error", () => {
    expect(limitIssues(bulkDocument(5, 400), "LIMIT_WARNING")).toContain("nodesPerPage");
    expect(limitIssues(bulkDocument(11, 455), "LIMITS")).toContain("nodesPerPage");
  });

  it("page per situs > 100 → LIMITS", () => {
    const doc = minimalDocument();
    for (let i = 0; i < 100; i++) {
      const id = `pg_p${pad(i)}`;
      doc.nodes[id] = {
        ...structuredClone(doc.nodes[HOME] as Node),
        id,
        name: id,
        props: { path: `/p${i}`, title: id, isHome: false },
      } as Node;
      doc.pageOrder.push(id);
    }
    expect(limitIssues(doc, "LIMITS")).toEqual(["pagesPerSite"]);
  });

  it("teks per node: > 5.000 warning, > 20.000 error", () => {
    const doc = heroDocument();
    doc.nodes.n_herottl001 = textNode("n_herottl001", "n_hero000001", "a".repeat(5_001));
    expect(limitIssues(doc, "LIMIT_WARNING")).toEqual(["textCharsPerNode"]);
    doc.nodes.n_herottl001 = textNode("n_herottl001", "n_hero000001", "a".repeat(20_001));
    expect(limitIssues(doc, "LIMITS")).toEqual(["textCharsPerNode"]);
  });

  it("kedalaman: > 20 warning; > 32 tetap kode DEPTH", () => {
    expect(limitIssues(deepDocument(21).doc, "LIMIT_WARNING")).toEqual(["treeDepth"]);
    expect(limitIssues(deepDocument(20).doc, "LIMIT_WARNING")).toEqual([]);
    const deep = validateDocument(deepDocument(33).doc, { mode: "edit" });
    expect(deep.errors.map((issue) => issue.code)).toEqual(["DEPTH"]);
  });

  it("token theme > 500 → LIMITS", () => {
    const doc = minimalDocument();
    doc.theme.tokens.color = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`c${i}`, "#000000"]));
    expect(limitIssues(doc, "LIMITS")).toEqual(["tokensTotal"]);
  });
});

describe("command → LIMIT_EXCEEDED tanpa penulisan parsial (AC DM-076)", () => {
  it("createNode: container penuh (500 anak)", () => {
    const { ctx, read } = setupDoc(bulkDocument(1, 500));
    const before = read();
    const result = runCommand(ctx, createNode, { parentId: "n_f00000000", type: "frame" });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "LIMIT_EXCEEDED", details: { limit: "childrenPerContainer", value: 501, max: 500 } },
    });
    expect(read()).toEqual(before);
  });

  it("createNode: kedalaman 32 & teks terlalu panjang", () => {
    const { ctx } = setupDoc(deepDocument(32).doc);
    expect(runCommand(ctx, createNode, { parentId: deepDocument(32).deepest, type: "frame" })).toMatchObject({
      error: { code: "LIMIT_EXCEEDED", details: { limit: "treeDepth" } },
    });
    const hero = setupDoc(heroDocument());
    const content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(20_001) }] }],
    };
    expect(
      runCommand(hero.ctx, createNode, { parentId: "n_hero000001", type: "text", props: { content } }),
    ).toMatchObject({
      error: { code: "LIMIT_EXCEEDED", details: { limit: "textCharsPerNode" } },
    });
  });

  it("createNode: node per page penuh (5.000)", () => {
    // 1 page + 10 frame + 10 × 498 teks = 4.991 node; 9 node lagi (satu per frame) → tepat 5.000.
    const doc = bulkDocument(10, 498);
    expect(Object.keys(doc.nodes)).toHaveLength(4_991);
    const { ctx } = setupDoc(doc);
    for (let f = 0; f < 9; f++) {
      expect(runCommand(ctx, createNode, { parentId: `n_f${pad(f)}`, type: "frame" }).ok).toBe(true);
    }
    expect(runCommand(ctx, createNode, { parentId: "n_f00000009", type: "frame" })).toMatchObject({
      error: { code: "LIMIT_EXCEEDED", details: { limit: "nodesPerPage", value: 5_001 } },
    });
  });

  it("moveNode: target penuh & kedalaman subtree di tujuan", () => {
    const doc = bulkDocument(2, 500);
    const { ctx, read } = setupDoc(doc);
    const before = read();
    expect(runCommand(ctx, moveNode, { id: "n_t00000000", newParentId: "n_f00000001", index: 0 })).toMatchObject({
      error: { code: "LIMIT_EXCEEDED", details: { limit: "childrenPerContainer" } },
    });
    expect(read()).toEqual(before);
    // Reorder di parent yang sama tetap boleh meski penuh.
    expect(runCommand(ctx, moveNode, { id: "n_t00000000", newParentId: "n_f00000000", index: 3 }).ok).toBe(true);

    const deep = deepDocument(30);
    deep.doc.nodes.n_sub0000001 = frameNode("n_sub0000001", HOME, ["n_sub0000002"]);
    deep.doc.nodes.n_sub0000002 = frameNode("n_sub0000002", "n_sub0000001", ["n_sub0000003"]);
    deep.doc.nodes.n_sub0000003 = frameNode("n_sub0000003", "n_sub0000002", []);
    const home = deep.doc.nodes[HOME];
    if (home && "children" in home) home.children.push("n_sub0000001");
    const moving = setupDoc(deep.doc);
    // Tujuan depth 30 → subtree (tinggi 2) di level 31..33 > 32.
    expect(runCommand(moving.ctx, moveNode, { id: "n_sub0000001", newParentId: deep.deepest, index: 0 })).toMatchObject(
      {
        error: { code: "LIMIT_EXCEEDED", details: { limit: "treeDepth", value: 33 } },
      },
    );
  });

  it("angka batas sesuai DM-076", () => {
    expect(DOCUMENT_LIMITS).toMatchObject({
      nodesPerPage: { soft: 2_000, hard: 5_000 },
      nodesPerSite: { hard: 20_000 },
      pagesPerSite: { hard: 100 },
      treeDepth: { soft: 20, hard: 32 },
      childrenPerContainer: { hard: 500 },
      textCharsPerNode: { soft: 5_000, hard: 20_000 },
      tokensTotal: { hard: 500 },
    });
  });
});
