import {
  jsonToYDoc,
  moveNode,
  runCommand,
  type SiteDocument,
  SiteDocumentSchema,
  updateStyle,
  yDocToJson,
} from "@platform/document-model";
import { freeformDocument } from "@platform/document-model/fixtures";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createUndoController, MAX_UNDO_STEPS, type UndoController } from "./undo-controller";

const LOCAL = { kind: "user", sessionId: "test" } as const;
const REMOTE = { kind: "remote" };
const [CARD, IMAGE, TEXT] = ["n_fcard00001", "n_fimage0001", "n_ftext00001"];

const controllers: UndoController[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.destroy();
});

function setup(fixture: SiteDocument = freeformDocument()) {
  const doc = jsonToYDoc(fixture);
  let selected: readonly string[] = [];
  const undo = createUndoController(doc, [LOCAL], {
    get: () => selected,
    restore: (ids) => {
      selected = ids;
    },
    exists: (id) => doc.getMap("nodes").has(id),
  });
  controllers.push(undo);
  const ctx = { doc, origin: LOCAL };
  return {
    doc,
    undo,
    read: (): SiteDocument => SiteDocumentSchema.parse(yDocToJson(doc)),
    select: (ids: string[]) => {
      selected = ids;
    },
    selected: () => selected,
    // Aksi diskrit seperti commit drag: dibatasi stopCapturing agar tidak digabung captureTimeout.
    action: (op: Parameters<typeof runCommand>[1], input: unknown) => {
      undo.stopCapturing();
      const result = runCommand(ctx, op, input);
      undo.stopCapturing();
      if (!result.ok) throw new Error(result.error.message.id);
    },
  };
}

describe("UndoController (ED-197, DM-060)", () => {
  it("drag + resize + ubah style = 3 langkah undo; seleksi dipulihkan tiap langkah (T0.7.1)", () => {
    const editor = setup();
    const states = [editor.read()];

    editor.select([CARD]);
    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 200, y: 150 } } }); // drag
    states.push(editor.read());
    editor.select([IMAGE]);
    editor.action(updateStyle, {
      ids: [IMAGE],
      patch: { size: { width: { mode: "fixed", value: 500, unit: "px" } } },
    }); // resize
    states.push(editor.read());
    editor.select([TEXT]);
    editor.action(updateStyle, { ids: [TEXT], patch: { fills: [{ type: "solid", color: "#FF0000" }] } }); // style
    editor.select([]);

    expect(editor.undo.manager.undoStack).toHaveLength(3);
    editor.undo.undo();
    expect(editor.read()).toEqual(states[2]);
    expect(editor.selected()).toEqual([TEXT]);
    editor.undo.undo();
    expect(editor.read()).toEqual(states[1]);
    expect(editor.selected()).toEqual([IMAGE]);
    editor.undo.undo();
    expect(editor.read()).toEqual(states[0]);
    expect(editor.selected()).toEqual([CARD]);
    expect(editor.undo.canUndo()).toBe(false);
  });

  it("redo memulihkan dokumen & seleksi sesudah aksi", () => {
    const editor = setup();
    editor.select([CARD]);
    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 10, y: 20 } } });
    const after = editor.read();

    editor.undo.undo();
    editor.select([]);
    editor.undo.redo();

    expect(editor.read()).toEqual(after);
    expect(editor.selected()).toEqual([CARD]);
  });

  it("perubahan beruntun dalam captureTimeout digabung; aksi diskrit dipisah stopCapturing", () => {
    const editor = setup();
    const ctx = { doc: editor.doc, origin: LOCAL };
    // Mis. nudge keyboard berturut-turut: tanpa stopCapturing → satu langkah.
    runCommand(ctx, updateStyle, { ids: [CARD], patch: { position: { x: 81 } } });
    runCommand(ctx, updateStyle, { ids: [CARD], patch: { position: { x: 82 } } });
    expect(editor.undo.manager.undoStack).toHaveLength(1);

    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 90 } } });
    expect(editor.undo.manager.undoStack).toHaveLength(2);
  });

  it("perubahan origin remote/system tidak pernah di-undo (dua Y.Doc tersinkron)", () => {
    const editor = setup();
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(editor.doc));

    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 300 } } });
    // Kolaborator memindah gambar; update diterapkan ke dokumen lokal dengan origin remote.
    const before = Y.encodeStateVector(remote);
    runCommand({ doc: remote, origin: LOCAL }, updateStyle, { ids: [IMAGE], patch: { position: { y: 999 } } });
    Y.applyUpdate(editor.doc, Y.encodeStateAsUpdate(remote, before), REMOTE);

    editor.undo.undo();

    const doc = editor.read();
    expect(doc.nodes[CARD]?.style.base.position).toMatchObject({ x: 80 });
    expect(doc.nodes[IMAGE]?.style.base.position).toMatchObject({ y: 999 });
    expect(editor.undo.canUndo()).toBe(false);
  });

  it("AC ED-197: 50 aksi beragam → 50× undo = state awal; 50× redo = state akhir", () => {
    const editor = setup();
    const initial = editor.read();
    for (let i = 0; i < 50; i++) {
      if (i % 3 === 0) editor.action(updateStyle, { ids: [CARD], patch: { position: { x: i, y: i * 2 } } });
      else if (i % 3 === 1) {
        editor.action(updateStyle, {
          ids: [IMAGE],
          patch: { size: { height: { mode: "fixed", value: 100 + i, unit: "px" } } },
        });
      } else editor.action(moveNode, { id: TEXT, newParentId: "n_board00001", index: i % 3 });
    }
    const final = editor.read();

    for (let i = 0; i < 50; i++) editor.undo.undo();
    expect(editor.read()).toEqual(initial);
    for (let i = 0; i < 50; i++) editor.undo.redo();
    expect(editor.read()).toEqual(final);
  });

  it(`kedalaman stack dibatasi ${MAX_UNDO_STEPS} langkah`, () => {
    const editor = setup();
    for (let i = 0; i < MAX_UNDO_STEPS + 15; i++) {
      editor.action(updateStyle, { ids: [CARD], patch: { position: { x: i } } });
    }
    expect(editor.undo.manager.undoStack).toHaveLength(MAX_UNDO_STEPS);
  });

  it("node yang sudah tidak ada disaring dari seleksi yang dipulihkan", () => {
    const editor = setup();
    editor.select([CARD, "n_ghost00001"]);
    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 5 } } });

    editor.undo.undo();

    expect(editor.selected()).toEqual([CARD]);
  });
});

describe("UndoController — status stack", () => {
  it("canUndo/canRedo mengikuti isi stack", () => {
    const editor = setup();
    expect([editor.undo.canUndo(), editor.undo.canRedo()]).toEqual([false, false]);

    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 1 } } });
    expect([editor.undo.canUndo(), editor.undo.canRedo()]).toEqual([true, false]);

    editor.undo.undo();
    expect([editor.undo.canUndo(), editor.undo.canRedo()]).toEqual([false, true]);
  });
});

describe("UndoController — grup sesi edit teks (ED-115)", () => {
  it("langkah di dalam grup tetap granular, lalu digabung jadi satu langkah saat grup ditutup", () => {
    const editor = setup();
    const initial = editor.read();
    editor.select([CARD]);
    const group = editor.undo.beginGroup();
    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 1 } } });
    editor.select([IMAGE]);
    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 2 } } });
    editor.select([TEXT]);
    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 3 } } });
    expect(editor.undo.manager.undoStack).toHaveLength(3);

    group.end();
    const final = editor.read();

    expect(editor.undo.manager.undoStack).toHaveLength(1);
    editor.undo.undo();
    expect(editor.read()).toEqual(initial);
    expect(editor.selected()).toEqual([CARD]);
    editor.undo.redo();
    expect(editor.read()).toEqual(final);
    expect(editor.selected()).toEqual([TEXT]);
  });

  it("langkah sebelum grup tidak ikut digabung; grup tanpa perubahan tidak menambah langkah", () => {
    const editor = setup();
    editor.action(updateStyle, { ids: [IMAGE], patch: { position: { y: 9 } } });
    editor.undo.beginGroup().end();
    expect(editor.undo.manager.undoStack).toHaveLength(1);

    const group = editor.undo.beginGroup();
    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 1 } } });
    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 2 } } });
    group.end();
    expect(editor.undo.manager.undoStack).toHaveLength(2);
  });

  it("undo di dalam grup melewati awal grup → tidak ada yang digabung", () => {
    const editor = setup();
    editor.action(updateStyle, { ids: [IMAGE], patch: { position: { y: 9 } } });
    const group = editor.undo.beginGroup();
    editor.action(updateStyle, { ids: [CARD], patch: { position: { x: 1 } } });
    editor.undo.undo();
    editor.undo.undo();
    group.end();
    expect(editor.undo.manager.undoStack).toHaveLength(0);
    expect(editor.undo.manager.redoStack).toHaveLength(2);
  });
});

// T1.9.2: cakupan undo = semua root dokumen (DM-060).
describe("cakupan undo", () => {
  it("edit theme & settings lokal bisa di-undo", () => {
    const { doc, undo, read } = setup();
    const before = read();
    doc.transact(() => {
      (doc.getMap("theme").get("tokens") as Y.Map<Y.Map<unknown>>).get("color")?.set("primary", "#000000");
      doc.getMap("settings").set("manualResponsive", true);
    }, LOCAL);
    expect(read()).not.toEqual(before);
    undo.undo();
    expect(read()).toEqual(before);
  });
});
