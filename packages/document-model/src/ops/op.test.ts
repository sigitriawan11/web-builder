import { describe, expect, it } from "vitest";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { setupDoc } from "../../test/op-harness";
import { createNode } from "./create-node";
import { deleteNodes } from "./delete-nodes";
import { moveNode } from "./move-node";
import { runOp } from "./op";
import { updateStyle } from "./update-style";

describe("runOp", () => {
  it("menjalankan op dalam satu transaksi dengan origin dari context", () => {
    const { ctx, doc } = setupDoc(heroDocument());
    const origins: unknown[] = [];
    doc.on("afterTransaction", (transaction) => origins.push(transaction.origin));

    runOp(ctx, deleteNodes, { ids: ["n_hero000001"] });

    expect(origins).toEqual([ctx.origin]);
  });

  it.each([
    { name: "createNode", run: (ctx: Parameters<typeof runOp>[0]) => runOp(ctx, createNode, { parentId: "n_herottl001", type: "frame" }) },
    { name: "moveNode", run: (ctx: Parameters<typeof runOp>[0]) => runOp(ctx, moveNode, { id: "n_hero000001", newParentId: "n_herottl001", index: 0 }) },
    { name: "updateStyle", run: (ctx: Parameters<typeof runOp>[0]) => runOp(ctx, updateStyle, { ids: ["n_hero000001", "n_ghost00001"], patch: { radius: null } }) },
    { name: "deleteNodes", run: (ctx: Parameters<typeof runOp>[0]) => runOp(ctx, deleteNodes, { ids: ["n_hero000001", "n_ghost00001"] }) },
  ])("$name yang gagal tidak menghasilkan update Yjs sama sekali", ({ run }) => {
    const { ctx, doc } = setupDoc(heroDocument());
    let updates = 0;
    doc.on("update", () => updates++);

    expect(run(ctx).ok).toBe(false);
    expect(updates).toBe(0);
  });

  it("tiap op adalah satu langkah undo terpisah", () => {
    const { ctx, read, undoManager } = setupDoc(heroDocument());

    runOp(ctx, updateStyle, { ids: ["n_hero000001"], patch: { radius: null } });
    const afterFirst = read();
    runOp(ctx, moveNode, { id: "n_heroimg001", newParentId: "pg_home000001", index: 0 });

    undoManager.undo();
    expect(read()).toEqual(afterFirst);
    undoManager.undo();
    expect(read()).toEqual(heroDocument());
  });
});
