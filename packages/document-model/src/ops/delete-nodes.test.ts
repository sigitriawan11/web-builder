import { describe, expect, it } from "vitest";
import { heroDocument, nestedDocument } from "../../test/fixtures/basic-documents";
import { setupDoc } from "../../test/op-harness";
import { deleteNodes } from "./delete-nodes";
import { runOp } from "./op";

describe("deleteNodes", () => {
  it("menghapus node beserta seluruh turunannya dan melepasnya dari parent", () => {
    const { ctx, read } = setupDoc(heroDocument());

    const result = runOp(ctx, deleteNodes, { ids: ["n_hero000001"] });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.removedIds.sort()).toEqual(["n_hero000001", "n_heroimg001", "n_herottl001"]);
    const doc = read();
    expect(Object.keys(doc.nodes).sort()).toEqual(["pg_about00001", "pg_home000001"]);
    expect(doc.nodes.pg_home000001).toMatchObject({ children: [] });
  });

  it("menerima id yang tumpang tindih (node dan turunannya)", () => {
    const { ctx, read } = setupDoc(nestedDocument());

    const result = runOp(ctx, deleteNodes, { ids: ["n_lvl4text001", "n_lvl2000001", "n_lvl4text001"] });

    expect(result.ok).toBe(true);
    const doc = read();
    expect(Object.keys(doc.nodes).sort()).toEqual(["n_lvl1000001", "pg_home000001"]);
    expect(doc.nodes.n_lvl1000001).toMatchObject({ children: [] });
  });

  it.each([
    { name: "page", ids: ["pg_home000001"], code: "INVALID_TARGET" },
    { name: "salah satu node tidak ada", ids: ["n_lvl4img0001", "n_ghost00001"], code: "NOT_FOUND" },
    { name: "daftar kosong", ids: [], code: "INVALID_INPUT" },
  ])("gagal tanpa perubahan saat menghapus $name", ({ ids, code }) => {
    const { ctx, read } = setupDoc(nestedDocument());

    expect(runOp(ctx, deleteNodes, { ids })).toMatchObject({ ok: false, error: { code } });
    expect(read()).toEqual(nestedDocument());
  });

  it("bisa di-undo dalam satu langkah, mengembalikan seluruh subtree", () => {
    const { ctx, read, undoManager } = setupDoc(nestedDocument());

    runOp(ctx, deleteNodes, { ids: ["n_lvl1000001"] });
    undoManager.undo();

    expect(read()).toEqual(nestedDocument());
  });
});
