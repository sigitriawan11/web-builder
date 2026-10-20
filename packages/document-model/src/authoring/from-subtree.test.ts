import { describe, expect, it } from "vitest";
import type { Node } from "../schema";
import { validateComponentDefinition } from "../validate/component";
import { componentFromSubtree } from "./from-subtree";

// Dokumen mini: page → frame(card) → [text, image]. Subtree "card" diekstrak jadi component.
const node = (over: Partial<Node> & { id: string; type: string }): Node => ({ ...over }) as unknown as Node;
const nodes: Record<string, Node> = {
  pg_home: node({ id: "pg_home", type: "page", parentId: null, name: "Home", children: ["n_card0001"] } as never),
  n_card0001: node({
    id: "n_card0001",
    type: "frame",
    name: "Card",
    parentId: "pg_home",
    visible: true,
    locked: false,
    tag: "div",
    children: ["n_title0001", "n_img00001"],
    style: { base: {} },
    props: {},
  } as never),
  n_title0001: node({
    id: "n_title0001",
    type: "text",
    name: "Title",
    parentId: "n_card0001",
    visible: true,
    locked: false,
    tag: "h3",
    style: { base: {} },
    props: { content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Judul" }] }] } },
  } as never),
  n_img00001: node({
    id: "n_img00001",
    type: "image",
    name: "Gambar",
    parentId: "n_card0001",
    visible: true,
    locked: false,
    style: { base: {} },
    props: {},
  } as never),
};

describe("componentFromSubtree (CMP-011)", () => {
  it("subtree → ComponentDefinition valid: root parentId null, ID node dipertahankan, hanya subtree", () => {
    const def = componentFromSubtree({ nodes }, "n_card0001", {
      id: "cmp_card0001",
      name: "ProductCard",
      category: "card",
    });
    expect(validateComponentDefinition(def)).toMatchObject({ ok: true });
    expect(def.rootId).toBe("n_card0001");
    // Root jadi parentId null; descendant tetap menunjuk di dalam subtree; page TIDAK ikut.
    expect((def.nodes.n_card0001 as { parentId: unknown }).parentId).toBeNull();
    expect((def.nodes.n_title0001 as { parentId: unknown }).parentId).toBe("n_card0001");
    expect(Object.keys(def.nodes).sort()).toEqual(["n_card0001", "n_img00001", "n_title0001"]);
    expect("pg_home" in def.nodes).toBe(false);
    // ID node stabil (DM-045) — tidak di-rekey.
    expect(def.name).toBe("ProductCard");
    expect(def.version).toBe(1);
  });

  it("tidak memutasi dokumen sumber (deep clone)", () => {
    const def = componentFromSubtree({ nodes }, "n_card0001", { id: "cmp_x0000001", name: "X", category: "card" });
    (def.nodes.n_card0001 as { parentId: unknown }).parentId = "diubah";
    expect(nodes.n_card0001?.parentId).toBe("pg_home"); // sumber tetap
  });

  it("rootId tidak ada → error", () => {
    expect(() => componentFromSubtree({ nodes }, "n_tidakada", { id: "cmp_x", name: "X", category: "card" })).toThrow();
  });
});
