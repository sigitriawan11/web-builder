import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { freeformDocument, heroDocument, nestedDocument } from "../../test/fixtures/basic-documents";
import { ID_PATTERN } from "../ids";
import type { Node } from "../schema";
import { validateDocument } from "../validate/validate-document";
import { type CommandContext, runCommand } from "./command";
import { createNode } from "./create-node";
import { deleteNodes } from "./delete-nodes";
import { moveNode } from "./move-node";
import { renameNode, reorderNode, setLocked, setTag, setVisible } from "./node-fields";
import { duplicateNodes, insertSubtree, type Subtree } from "./subtree";
import { updateStyle } from "./update-style";

// T1.9.5: command node & tree (DM-074, DM-007).
const text = (parentId: string, value: string, extra: Record<string, unknown> = {}) => ({
  type: "text",
  name: value,
  parentId,
  visible: true,
  locked: false,
  style: { base: {} },
  props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: value }] }] } },
  ...extra,
});

const section: Subtree = {
  rootIds: ["tmp_section"],
  nodes: {
    tmp_section: {
      type: "frame",
      name: "Testimoni",
      parentId: "tmp_x",
      children: ["tmp_title", "tmp_cta"],
      visible: true,
      locked: false,
      tag: "section",
      htmlId: "testimoni",
      style: { base: { layout: { mode: "flex", direction: "column" } } },
      props: {},
    },
    tmp_title: text("tmp_section", "Kata pelanggan"),
    tmp_cta: text("tmp_section", "Ke judul", { tag: "p" }),
  },
};
// Link anchor di dalam subtree menunjuk node subtree lain (harus di-remap).
(section.nodes.tmp_cta as { props: { content: unknown } }).props.content = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Ke judul",
          marks: [{ type: "link", attrs: { link: { type: "anchor", nodeId: "tmp_title" } } }],
        },
      ],
    },
  ],
};

const countUpdates = (ctx: CommandContext) => {
  let updates = 0;
  ctx.doc.on("update", () => updates++);
  return () => updates;
};

describe("insertSubtree", () => {
  it("menyisipkan subtree, mengembalikan peta tmp_* → ID baru, me-remap rujukan internal", () => {
    const { ctx, read } = setupDoc(heroDocument());
    const result = runCommand(ctx, insertSubtree, { parentId: "pg_home000001", index: 1, subtree: section });
    if (!result.ok) throw new Error(result.error.message.id);
    const { idMap } = result.value;
    expect(Object.keys(idMap).sort()).toEqual(["tmp_cta", "tmp_section", "tmp_title"]);
    for (const id of Object.values(idMap)) expect(id).toMatch(ID_PATTERN);

    const doc = read();
    const page = doc.nodes.pg_home000001;
    expect(page && "children" in page ? page.children : []).toEqual(["n_hero000001", idMap.tmp_section]);
    const sectionNode = doc.nodes[idMap.tmp_section as string];
    expect(sectionNode).toMatchObject({ parentId: "pg_home000001", htmlId: "testimoni" });
    expect(sectionNode && "children" in sectionNode ? sectionNode.children : []).toEqual([
      idMap.tmp_title,
      idMap.tmp_cta,
    ]);
    expect(JSON.stringify(doc.nodes[idMap.tmp_cta as string])).toContain(`"nodeId":"${idMap.tmp_title}"`);
    expect(validateDocument(doc, { mode: "publish" }).ok).toBe(true);
  });

  it.each([
    [
      "node tidak valid",
      { ...section, nodes: { ...section.nodes, tmp_title: { ...text("tmp_section", "x"), tag: "div" } } },
      "INVALID_INPUT",
    ],
    ["node yatim", { ...section, nodes: { ...section.nodes, tmp_lost: text("tmp_section", "x") } }, "INVALID_INPUT"],
    ["berisi page", { rootIds: ["tmp_p"], nodes: { tmp_p: { type: "page" } } }, "INVALID_INPUT"],
    [
      "child hilang",
      { rootIds: ["tmp_section"], nodes: { tmp_section: section.nodes.tmp_section ?? {} } },
      "INVALID_INPUT",
    ],
  ])("%s → ditolak tanpa perubahan", (_, subtree, code) => {
    const { ctx } = setupDoc(heroDocument());
    const updates = countUpdates(ctx);
    expect(runCommand(ctx, insertSubtree, { parentId: "pg_home000001", subtree })).toMatchObject({
      ok: false,
      error: { code },
    });
    expect(updates()).toBe(0);
  });

  it("htmlId yang sudah dipakai di page tujuan ditolak", () => {
    const { ctx } = setupDoc(heroDocument());
    expect(runCommand(ctx, insertSubtree, { parentId: "pg_home000001", subtree: section }).ok).toBe(true);
    expect(runCommand(ctx, insertSubtree, { parentId: "pg_home000001", subtree: section })).toMatchObject({
      ok: false,
      error: { code: "INVALID_RESULT", message: { en: expect.stringContaining('htmlId "testimoni"') } },
    });
  });
});

describe("duplicateNodes (AC DM-007)", () => {
  it("salinan tepat setelah aslinya, ID baru, rujukan internal di-remap, htmlId tidak ikut, asli tak berubah", () => {
    const { ctx, read } = setupDoc(heroDocument());
    runCommand(ctx, insertSubtree, { parentId: "pg_home000001", subtree: section });
    const before = read();
    const [sectionId] = Object.keys(before.nodes).filter((id) => before.nodes[id]?.htmlId === "testimoni");
    if (!sectionId) throw new Error("section tidak ada");

    const result = runCommand(ctx, duplicateNodes, { ids: [sectionId] });
    if (!result.ok) throw new Error(result.error.message.id);
    const after = read();
    const copyId = result.value.idMap[sectionId] as string;
    const page = after.nodes.pg_home000001;
    expect(page && "children" in page ? page.children : []).toEqual(["n_hero000001", sectionId, copyId]);
    expect(after.nodes[copyId]?.htmlId).toBeUndefined();
    for (const [oldId, newId] of Object.entries(result.value.idMap)) {
      expect(newId).not.toBe(oldId);
      expect(after.nodes[oldId]).toEqual(before.nodes[oldId]);
    }
    // Anchor di salinan menunjuk judul salinan, bukan judul asli.
    const original = before.nodes[sectionId] as Extract<Node, { children: string[] }>;
    const [origTitle, origCta] = original.children;
    const copyCta = result.value.idMap[origCta as string] as string;
    expect(JSON.stringify(after.nodes[copyCta])).toContain(`"nodeId":"${result.value.idMap[origTitle as string]}"`);
    expect(validateDocument(after, { mode: "publish" }).ok).toBe(true);
  });

  it("offset menggeser salinan absolute; pilihan bersarang tidak diduplikasi dua kali", () => {
    const { ctx, read } = setupDoc(freeformDocument());
    const result = runCommand(ctx, duplicateNodes, { ids: ["n_fcard00001", "n_board00001"], offset: { x: 10, y: 20 } });
    if (!result.ok) throw new Error(result.error.message.id);
    const doc = read();
    expect(Object.keys(result.value.idMap)).toHaveLength(4);
    const copyCard = doc.nodes[result.value.idMap.n_fcard00001 as string];
    // Board (flow) tidak bergeser; kartu di dalam salinan board tetap di posisi relatifnya.
    expect(copyCard?.style.base.position).toEqual({ type: "absolute", x: 80, y: 80 });

    const single = runCommand(ctx, duplicateNodes, { ids: ["n_fcard00001"], offset: { x: 10, y: 20 } });
    if (!single.ok) throw new Error(single.error.message.id);
    expect(read().nodes[single.value.idMap.n_fcard00001 as string]?.style.base.position).toEqual({
      type: "absolute",
      x: 90,
      y: 100,
    });
    // Regresi: offset tidak boleh menggeser node asli (nilai daun Yjs tidak boleh dimutasi).
    expect(read().nodes.n_fcard00001?.style.base.position).toEqual({ type: "absolute", x: 80, y: 80 });
  });

  it("page tidak bisa diduplikasi lewat command ini", () => {
    const { ctx } = setupDoc(heroDocument());
    expect(runCommand(ctx, duplicateNodes, { ids: ["pg_home000001"] })).toMatchObject({
      error: { code: "INVALID_TARGET" },
    });
  });
});

describe("moveNode keepVisualPosition (AC DM-074)", () => {
  it("diturunkan dari dokumen via ancestor bersama bila semua posisi absolute", () => {
    const { ctx, read } = setupDoc(freeformDocument());
    runCommand(ctx, updateStyle, { ids: ["n_fcard00001"], patch: { layout: { mode: "none" } } });
    const result = runCommand(ctx, moveNode, {
      id: "n_ftext00001",
      newParentId: "n_fcard00001",
      index: 0,
      keepVisualPosition: true,
    });
    expect(result.ok).toBe(true);
    // Teks (80, 320) di board → kartu (80, 80) di board ⇒ (0, 240) relatif kartu.
    expect(read().nodes.n_ftext00001?.style.base.position).toEqual({ type: "absolute", x: 0, y: 240 });
  });

  it("memakai `measured` dari editor bila ada ancestor ber-flow; tanpa itu ditolak informatif", () => {
    const { ctx, read } = setupDoc(heroDocument());
    runCommand(ctx, updateStyle, { ids: ["n_hero000001"], patch: { layout: { mode: "none" } } });
    runCommand(ctx, createNode, { parentId: "pg_home000001", type: "frame", name: "Target" });
    const target = Object.values(read().nodes).find((node) => node.name === "Target");
    if (!target) throw new Error("target tidak ada");
    runCommand(ctx, updateStyle, { ids: [target.id], patch: { layout: { mode: "none" } } });

    const blind = runCommand(ctx, moveNode, {
      id: "n_herottl001",
      newParentId: target.id,
      index: 0,
      keepVisualPosition: true,
    });
    expect(blind).toMatchObject({ ok: false, error: { code: "INVALID_INPUT", path: ["measured"] } });

    const measured = { node: { x: 300, y: 500 }, newParent: { x: 100, y: 450 } };
    expect(
      runCommand(ctx, moveNode, {
        id: "n_herottl001",
        newParentId: target.id,
        index: 0,
        keepVisualPosition: true,
        measured,
      }).ok,
    ).toBe(true);
    expect(read().nodes.n_herottl001?.style.base.position).toEqual({ type: "absolute", x: 200, y: 50 });
  });

  it("ke turunan sendiri → CYCLE", () => {
    const { ctx } = setupDoc(heroDocument());
    expect(runCommand(ctx, moveNode, { id: "n_hero000001", newParentId: "n_hero000001", index: 0 })).toMatchObject({
      error: { code: "CYCLE" },
    });
  });
});

describe("command field node", () => {
  it("reorderNode di parent yang sama; index melebihi = paling akhir", () => {
    const { ctx, read } = setupDoc(heroDocument());
    expect(runCommand(ctx, reorderNode, { id: "n_herottl001", index: 99 }).ok).toBe(true);
    const hero = read().nodes.n_hero000001;
    expect(hero && "children" in hero ? hero.children : []).toEqual(["n_heroimg001", "n_herottl001"]);
    expect(runCommand(ctx, reorderNode, { id: "pg_home000001", index: 0 })).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });

  it("renameNode memangkas spasi; nama kosong ditolak", () => {
    const { ctx, read } = setupDoc(heroDocument());
    expect(runCommand(ctx, renameNode, { id: "n_hero000001", name: "  Hero Utama  " }).ok).toBe(true);
    expect(read().nodes.n_hero000001?.name).toBe("Hero Utama");
    expect(runCommand(ctx, renameNode, { id: "n_hero000001", name: "   " })).toMatchObject({
      error: { code: "INVALID_INPUT" },
    });
  });

  it("setVisible/setLocked banyak node; satu ID salah → tidak ada yang berubah", () => {
    const { ctx, read } = setupDoc(heroDocument());
    expect(runCommand(ctx, setVisible, { ids: ["n_herottl001", "n_heroimg001"], visible: false }).ok).toBe(true);
    expect(read().nodes.n_heroimg001?.visible).toBe(false);
    const updates = countUpdates(ctx);
    expect(runCommand(ctx, setLocked, { ids: ["n_herottl001", "n_tidakada001"], locked: true })).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
    expect(updates()).toBe(0);
    expect(read().nodes.n_herottl001?.locked).toBe(false);
  });

  it("setTag mengikuti daftar tag per tipe (DM-009)", () => {
    const { ctx, read } = setupDoc(heroDocument());
    expect(runCommand(ctx, setTag, { id: "n_herottl001", tag: "h2" }).ok).toBe(true);
    expect(read().nodes.n_herottl001?.tag).toBe("h2");
    expect(runCommand(ctx, setTag, { id: "n_hero000001", tag: "h2" })).toMatchObject({
      error: { code: "INVALID_RESULT" },
    });
    expect(runCommand(ctx, setTag, { id: "pg_home000001", tag: "main" }).ok).toBe(true);
  });
});

describe("property-based: urutan command acak tetap valid (fast-check)", () => {
  type Action =
    | { kind: "create"; parent: number; type: "frame" | "text" }
    | { kind: "move"; node: number; parent: number; index: number }
    | { kind: "delete"; node: number }
    | { kind: "duplicate"; node: number }
    | { kind: "reorder"; node: number; index: number }
    | { kind: "visible"; node: number; value: boolean }
    | { kind: "insert"; parent: number };

  const action: fc.Arbitrary<Action> = fc.oneof(
    fc.record({
      kind: fc.constant("create" as const),
      parent: fc.nat(),
      type: fc.constantFrom("frame" as const, "text" as const),
    }),
    fc.record({ kind: fc.constant("move" as const), node: fc.nat(), parent: fc.nat(), index: fc.nat(10) }),
    fc.record({ kind: fc.constant("delete" as const), node: fc.nat() }),
    fc.record({ kind: fc.constant("duplicate" as const), node: fc.nat() }),
    fc.record({ kind: fc.constant("reorder" as const), node: fc.nat(), index: fc.nat(10) }),
    fc.record({ kind: fc.constant("visible" as const), node: fc.nat(), value: fc.boolean() }),
    fc.record({ kind: fc.constant("insert" as const), parent: fc.nat() }),
  );

  it("setiap command berhasil/gagal tanpa merusak dokumen", () => {
    fc.assert(
      fc.property(fc.array(action, { maxLength: 25 }), (actions) => {
        const { ctx, read } = setupDoc(nestedDocument());
        for (const act of actions) {
          const doc = read();
          const all = Object.values(doc.nodes);
          const nonPages = all.filter((node) => node.type !== "page");
          const containers = all.filter((node) => "children" in node);
          const pick = <T>(list: readonly T[], index: number): T | undefined => list[index % Math.max(1, list.length)];
          const node = "node" in act ? pick(nonPages, act.node) : undefined;
          const parent = "parent" in act ? pick(containers, act.parent) : undefined;
          switch (act.kind) {
            case "create":
              if (parent) runCommand(ctx, createNode, { parentId: parent.id, type: act.type });
              break;
            case "move":
              if (node && parent) runCommand(ctx, moveNode, { id: node.id, newParentId: parent.id, index: act.index });
              break;
            case "delete":
              if (node) runCommand(ctx, deleteNodes, { ids: [node.id] });
              break;
            case "duplicate":
              if (node) runCommand(ctx, duplicateNodes, { ids: [node.id] });
              break;
            case "reorder":
              if (node) runCommand(ctx, reorderNode, { id: node.id, index: act.index });
              break;
            case "visible":
              if (node) runCommand(ctx, setVisible, { ids: [node.id], visible: act.value });
              break;
            case "insert":
              if (parent) {
                runCommand(ctx, insertSubtree, {
                  parentId: parent.id,
                  subtree: { rootIds: ["tmp_a"], nodes: { tmp_a: text("tmp_x", "Halo") } },
                });
              }
              break;
          }
          // `read()` mem-parse SiteDocumentSchema penuh (struktur + invariant) — melempar bila rusak.
          const result = validateDocument(read(), { mode: "edit" });
          if (!result.ok) throw new Error(JSON.stringify(result.errors.slice(0, 3)));
        }
      }),
      { numRuns: 60, seed: 20261014 },
    );
  });
});
