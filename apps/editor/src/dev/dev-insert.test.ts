import { createNode, jsonToYDoc, type Node, runCommand, YDOC_KEYS } from "@platform/document-model";
import { heroDocument } from "@platform/document-model/fixtures";
import { describe, expect, it } from "vitest";
import { NodeStore } from "../document/node-store";
import { type DevInsertContext, devInsertInput, devInsertParent, firstImageAsset } from "./dev-insert";

function setup(selectedIds: string[] = []) {
  const fixture = heroDocument();
  const doc = jsonToYDoc(fixture);
  const store = new NodeStore(doc);
  const ctx: DevInsertContext = {
    pageId: fixture.pageOrder[0] ?? "",
    selectedIds,
    getNode: store.getNode,
    imageAssetId: firstImageAsset(doc),
  };
  const run = (input: Record<string, unknown> | null) =>
    runCommand({ doc, origin: { kind: "user", sessionId: "t" } }, createNode, input);
  return { fixture, doc, store, ctx, run };
}

describe("tombol dev tambah node (T1.15.18)", () => {
  it("parent: page bila tanpa seleksi / multi; frame terseleksi → di dalamnya; teks terseleksi → parent-nya", () => {
    const { ctx, fixture } = setup();
    expect(devInsertParent(ctx)).toBe(fixture.pageOrder[0]);
    expect(devInsertParent({ ...ctx, selectedIds: ["n_hero000001"] })).toBe("n_hero000001");
    expect(devInsertParent({ ...ctx, selectedIds: ["n_herottl001"] })).toBe(
      (fixture.nodes.n_herottl001 as Node).parentId,
    );
    expect(devInsertParent({ ...ctx, selectedIds: ["n_hero000001", "n_herottl001"] })).toBe(fixture.pageOrder[0]);
    expect(devInsertParent({ ...ctx, selectedIds: ["n_tidakada01"] })).toBe(fixture.pageOrder[0]);
  });

  it.each(["frame", "text", "image"] as const)("input %s valid untuk command createNode", (kind) => {
    const { ctx, run, store } = setup();
    const result = run(devInsertInput(kind, ctx, "Teks baru"));
    expect(result.ok).toBe(true);
    const node = store.getNode(String(result.ok ? result.value : ""));
    expect(node?.type).toBe(kind);
  });

  it("gambar tanpa aset gambar terdaftar → tidak dibuat (tombol nonaktif)", () => {
    const { ctx, doc } = setup();
    doc.getMap(YDOC_KEYS.assets).clear();
    expect(firstImageAsset(doc)).toBeNull();
    expect(devInsertInput("image", { ...ctx, imageAssetId: null }, "x")).toBeNull();
  });
});
