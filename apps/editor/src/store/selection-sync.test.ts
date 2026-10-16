import { deleteNodes, jsonToYDoc, runCommand } from "@platform/document-model";
import { freeformDocument, heroDocument } from "@platform/document-model/fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { NodeStore } from "../document/node-store";
import { createUndoController } from "../document/undo-controller";
import { hoverStore } from "./hover-store";
import { selectionStore } from "./selection-store";
import { syncUiWithDocument } from "./selection-sync";
import { textEditingStore } from "./text-editing-store";

const LOCAL = { kind: "user", sessionId: "test" } as const;
const [CARD, IMAGE, TEXT] = ["n_fcard00001", "n_fimage0001", "n_ftext00001"];

const cleanups: (() => void)[] = [];
beforeEach(() => {
  selectionStore.getState().clear();
  hoverStore.getState().setHovered(null);
  textEditingStore.getState().stopEditing();
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function setup(fixture = freeformDocument()) {
  const doc = jsonToYDoc(fixture);
  const store = new NodeStore(doc);
  const exists = (id: string) => store.getNode(id) !== null;
  const undo = createUndoController(doc, [LOCAL], {
    get: () => selectionStore.getState().selectedIds,
    restore: (ids) => selectionStore.getState().select(ids),
    exists,
  });
  const stop = syncUiWithDocument(doc, exists);
  cleanups.push(
    stop,
    () => undo.destroy(),
    () => store.destroy(),
  );
  const remove = (ids: string[], origin: unknown = LOCAL) => {
    const result = runCommand({ doc, origin: origin as typeof LOCAL }, deleteNodes, { ids });
    if (!result.ok) throw new Error(JSON.stringify(result));
  };
  return { doc, undo, remove, stop };
}

describe("selectionStore", () => {
  it("anchor = node terakhir yang dipilih; prune menjaga anchor yang masih ada", () => {
    selectionStore.getState().select([CARD, IMAGE]);
    expect(selectionStore.getState().anchorId).toBe(IMAGE);
    selectionStore.getState().prune((id) => id !== IMAGE);
    expect(selectionStore.getState()).toMatchObject({ selectedIds: [CARD], anchorId: CARD });
    selectionStore.getState().clear();
    expect(selectionStore.getState().anchorId).toBeNull();
  });

  it("prune tanpa perubahan mempertahankan referensi (tidak memicu render ulang)", () => {
    selectionStore.getState().select([CARD]);
    const before = selectionStore.getState().selectedIds;
    selectionStore.getState().prune(() => true);
    expect(selectionStore.getState().selectedIds).toBe(before);
  });
});

describe("syncUiWithDocument (ED-061)", () => {
  it("node dihapus → keluar dari seleksi (unit test T1.15.9)", () => {
    const { remove } = setup();
    selectionStore.getState().select([CARD, TEXT]);
    remove([TEXT]);
    expect(selectionStore.getState().selectedIds).toEqual([CARD]);
  });

  it("menghapus parent ikut membuang turunan yang terseleksi", () => {
    const { remove } = setup(heroDocument());
    // Gambar hero adalah turunan section hero.
    selectionStore.getState().select(["n_heroimg001", "n_hero000001"]);
    remove(["n_hero000001"]);
    expect(selectionStore.getState().selectedIds).toEqual([]);
  });

  it("penghapusan dari kolaborator/AI (origin lain) juga membersihkan seleksi, hover, dan edit teks", () => {
    const { doc } = setup();
    selectionStore.getState().select([TEXT]);
    hoverStore.getState().setHovered(TEXT);
    textEditingStore.getState().startEditing(TEXT);

    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
    runCommand({ doc: remote, origin: { kind: "user", sessionId: "lain" } }, deleteNodes, { ids: [TEXT] });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)), { kind: "remote" });

    expect(selectionStore.getState().selectedIds).toEqual([]);
    expect(hoverStore.getState().hoveredId).toBeNull();
    expect(textEditingStore.getState().editingId).toBeNull();
  });

  it("AC: hapus → undo mengembalikan node dan seleksinya; redo menghapus lagi tanpa sisa seleksi", () => {
    const { undo, remove } = setup();
    selectionStore.getState().select([TEXT]);
    remove([TEXT]);
    expect(selectionStore.getState().selectedIds).toEqual([]);

    undo.undo();
    expect(selectionStore.getState().selectedIds).toEqual([TEXT]);
    undo.redo();
    expect(selectionStore.getState().selectedIds).toEqual([]);
  });

  it("dilepas → tidak lagi memangkas", () => {
    const { remove, stop } = setup();
    stop();
    selectionStore.getState().select([TEXT]);
    remove([TEXT]);
    expect(selectionStore.getState().selectedIds).toEqual([TEXT]);
  });
});
