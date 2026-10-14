import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { createNode } from "../ops/create-node";
import { runOp } from "../ops/op";
import { updateStyle } from "../ops/update-style";
import { SiteDocumentSchema } from "../schema";
import { applyDraft, draftUpdate, forkDocument } from "./draft";
import { jsonToYDoc, YDOC_KEYS, yDocToJson } from "./mapping";
import {
  aiOrigin,
  createDocumentUndoManager,
  describeOrigin,
  REMOTE_ORIGIN,
  releaseAiOrigin,
  systemOrigin,
  TxOriginSchema,
  userOrigin,
} from "./origin";

// T1.9.2: transaction origin & undo grouping (DM-060).
const read = (doc: Y.Doc) => SiteDocumentSchema.parse(yDocToJson(doc));

function setup() {
  const doc = jsonToYDoc(heroDocument());
  const user = userOrigin("sesi-1");
  // captureTimeout 0: setiap transaksi = satu langkah, agar test tidak bergantung waktu.
  const undo = createDocumentUndoManager(doc, [user], { captureTimeout: 0 });
  return { doc, user, undo };
}

const setGap = (doc: Y.Doc, origin: unknown, value: number) =>
  runOp({ doc, origin }, updateStyle, { ids: ["n_hero000001"], patch: { layout: { gap: { value, unit: "px" } } } });

describe("origin (DM-060)", () => {
  it("bentuk origin sesuai schema; instance AI & system stabil per kunci", () => {
    for (const origin of [userOrigin("s", "Ubah warna"), aiOrigin("run_1"), systemOrigin("migration"), REMOTE_ORIGIN]) {
      expect(TxOriginSchema.safeParse(origin).success).toBe(true);
    }
    expect(aiOrigin("run_1")).toBe(aiOrigin("run_1"));
    expect(aiOrigin("run_1")).not.toBe(aiOrigin("run_2"));
    expect(systemOrigin("repair")).toBe(systemOrigin("repair"));
    const before = aiOrigin("run_x");
    releaseAiOrigin("run_x");
    expect(aiOrigin("run_x")).not.toBe(before);
  });

  it("describeOrigin untuk penyimpanan & label history", () => {
    expect(describeOrigin(userOrigin("s", "Ubah warna"))).toEqual({ kind: "user", label: "Ubah warna" });
    expect(describeOrigin(aiOrigin("run_9"))).toEqual({ kind: "ai", aiRunId: "run_9" });
    expect(describeOrigin(systemOrigin("gc"))).toEqual({ kind: "system", label: "gc" });
    expect(describeOrigin(REMOTE_ORIGIN)).toEqual({ kind: "remote" });
    expect(describeOrigin(Symbol("y-sync"))).toEqual({ kind: "unknown" });
  });
});

describe("UndoManager dokumen", () => {
  it("hanya origin lokal yang di-undo; perubahan system (migrasi) tetap", () => {
    const { doc, user, undo } = setup();
    setGap(doc, user, 10);
    doc.transact(
      () => doc.getMap<unknown>(YDOC_KEYS.settings).set("manualResponsive", true),
      systemOrigin("migration"),
    );
    expect(undo.undoStack).toHaveLength(1);
    undo.undo();
    const after = read(doc);
    expect(after.nodes.n_hero000001?.style.base.layout).toMatchObject({ gap: { $token: "space.6" } });
    expect(after.settings.manualResponsive).toBe(true);
    expect(undo.canUndo()).toBe(false);
  });

  it("undo user tidak membatalkan perubahan remote (AC DM-060)", () => {
    const { doc, user, undo } = setup();
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc));

    setGap(doc, user, 10);
    peer.getMap<unknown>(YDOC_KEYS.settings).set("language", "en");
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(peer, Y.encodeStateVector(doc)), REMOTE_ORIGIN);

    undo.undo();
    const after = read(doc);
    expect(after.settings.language).toBe("en");
    expect(after.nodes.n_hero000001?.style.base.layout).toMatchObject({ gap: { $token: "space.6" } });
    expect(undo.canUndo()).toBe(false);
  });

  it("cakupan mencakup theme & settings (bukan hanya nodes)", () => {
    const { doc, user, undo } = setup();
    const before = read(doc);
    doc.transact(() => {
      (doc.getMap<unknown>(YDOC_KEYS.theme).get("tokens") as Y.Map<Y.Map<unknown>>)
        .get("color")
        ?.set("primary", "#000000");
      doc.getMap<unknown>(YDOC_KEYS.settings).set("manualResponsive", true);
    }, user);
    undo.undo();
    expect(read(doc)).toEqual(before);
  });

  it("meta origin tersimpan di setiap langkah (label history panel)", () => {
    const { doc, undo } = setup();
    const labelled = userOrigin("sesi-1", "Ubah jarak");
    undo.addTrackedOrigin(labelled);
    setGap(doc, labelled, 8);
    expect(undo.undoStack[0]?.meta.get("origin")).toEqual({ kind: "user", label: "Ubah jarak" });
  });
});

describe("run AI di draft (fork per run)", () => {
  it("25 command AI → satu undo() mengembalikan dokumen identik (AC DM-060); redo menerapkan ulang", () => {
    const { doc, user, undo } = setup();
    setGap(doc, user, 12);
    const beforeRun = read(doc);

    const fork = forkDocument(doc);
    const origin = aiOrigin("run_25");
    for (let i = 0; i < 25; i++) {
      const result =
        i % 2 === 0
          ? runOp({ doc: fork.draft, origin }, createNode, { parentId: "n_hero000001", type: "frame", name: `AI ${i}` })
          : setGap(fork.draft, origin, i);
      expect(result.ok).toBe(true);
    }
    // Dokumen utama belum berubah sampai "Terapkan".
    expect(read(doc)).toEqual(beforeRun);

    applyDraft(doc, draftUpdate(fork), "run_25", undo);
    const afterRun = read(doc);
    expect(Object.keys(afterRun.nodes)).toHaveLength(Object.keys(beforeRun.nodes).length + 13);
    expect(undo.undoStack.at(-1)?.meta.get("origin")).toEqual({ kind: "ai", aiRunId: "run_25" });

    undo.undo();
    expect(read(doc)).toEqual(beforeRun);
    undo.redo();
    expect(read(doc)).toEqual(afterRun);
    // Langkah user sebelum run tetap langkah terpisah.
    undo.undo();
    undo.undo();
    expect(read(doc).nodes.n_hero000001?.style.base.layout).toMatchObject({ gap: { $token: "space.6" } });
  });

  it("langkah AI tidak tergabung dengan edit user yang berdekatan meski dalam captureTimeout", () => {
    const doc = jsonToYDoc(heroDocument());
    const user = userOrigin("sesi-2");
    const undo = createDocumentUndoManager(doc, [user]);
    const fork = forkDocument(doc);
    setGap(fork.draft, aiOrigin("run_near"), 99);

    setGap(doc, user, 5);
    applyDraft(doc, draftUpdate(fork), "run_near", undo);
    setGap(doc, user, 6);
    expect(undo.undoStack).toHaveLength(3);
  });
});
