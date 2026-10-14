import { describe, expect, it } from "vitest";
import { setupDoc } from "../../test/command-harness";
import { heroDocument, nestedDocument } from "../../test/fixtures/basic-documents";
import type { SiteDocument } from "../schema";
import { runCommand } from "./command";
import { moveNode } from "./move-node";

function childrenOf(doc: SiteDocument, id: string): string[] | undefined {
  const node = doc.nodes[id];
  return node && "children" in node ? node.children : undefined;
}

describe("moveNode", () => {
  it("mengubah urutan di parent yang sama", () => {
    const { ctx, read } = setupDoc(heroDocument());

    const result = runCommand(ctx, moveNode, { id: "n_heroimg001", newParentId: "n_hero000001", index: 0 });

    expect(result.ok).toBe(true);
    expect(childrenOf(read(), "n_hero000001")).toEqual(["n_heroimg001", "n_herottl001"]);
  });

  it("memindah node ke parent lain dan memperbarui parentId", () => {
    const { ctx, read } = setupDoc(heroDocument());

    const result = runCommand(ctx, moveNode, { id: "n_heroimg001", newParentId: "pg_home000001", index: 0 });

    expect(result).toMatchObject({ ok: true, affected: ["n_heroimg001", "pg_home000001", "n_hero000001"] });
    const doc = read();
    expect(childrenOf(doc, "pg_home000001")).toEqual(["n_heroimg001", "n_hero000001"]);
    expect(childrenOf(doc, "n_hero000001")).toEqual(["n_herottl001"]);
    expect(doc.nodes.n_heroimg001?.parentId).toBe("pg_home000001");
  });

  it("menaruh node di akhir jika index melebihi jumlah anak", () => {
    const { ctx, read } = setupDoc(heroDocument());

    runCommand(ctx, moveNode, { id: "n_herottl001", newParentId: "n_hero000001", index: 99 });

    expect(childrenOf(read(), "n_hero000001")).toEqual(["n_heroimg001", "n_herottl001"]);
  });

  it.each([
    { name: "ke dirinya sendiri", input: { id: "n_lvl2000001", newParentId: "n_lvl2000001", index: 0 }, code: "CYCLE" },
    { name: "ke turunannya", input: { id: "n_lvl1000001", newParentId: "n_lvl3000001", index: 0 }, code: "CYCLE" },
    { name: "page", input: { id: "pg_home000001", newParentId: "n_lvl1000001", index: 0 }, code: "INVALID_TARGET" },
    {
      name: "parent tujuan bukan container",
      input: { id: "n_lvl4img0001", newParentId: "n_lvl4text001", index: 0 },
      code: "INVALID_TARGET",
    },
    { name: "node tidak ada", input: { id: "n_ghost00001", newParentId: "n_lvl1000001", index: 0 }, code: "NOT_FOUND" },
    {
      name: "index negatif",
      input: { id: "n_lvl4img0001", newParentId: "n_lvl1000001", index: -1 },
      code: "INVALID_INPUT",
    },
  ])("gagal tanpa perubahan saat memindah $name", ({ input, code }) => {
    const { ctx, read } = setupDoc(nestedDocument());

    expect(runCommand(ctx, moveNode, input)).toMatchObject({ ok: false, error: { code } });
    expect(read()).toEqual(nestedDocument());
  });

  it("bisa di-undo dalam satu langkah", () => {
    const { ctx, read, undoManager } = setupDoc(nestedDocument());

    runCommand(ctx, moveNode, { id: "n_lvl4img0001", newParentId: "n_lvl1000001", index: 0 });
    undoManager.undo();

    expect(read()).toEqual(nestedDocument());
  });
});
