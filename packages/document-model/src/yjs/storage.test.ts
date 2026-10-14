import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { heroDocument } from "../../test/fixtures/basic-documents";
import { generateLandingDocument, landing200 } from "../../test/fixtures/landing-generator";
import { createNode } from "../ops/create-node";
import { deleteNodes } from "../ops/delete-nodes";
import { runOp } from "../ops/op";
import { updateStyle } from "../ops/update-style";
import { SiteDocumentSchema } from "../schema";
import { jsonToYDoc, YDOC_KEYS, yDocToJson } from "./mapping";
import { createDocumentUndoManager, systemOrigin, userOrigin } from "./origin";
import { compactState, createJsonSnapshot, loadDocument, restoreDocument, stateSizeAfterUpdate } from "./storage";

// T1.9.3: encoding & penyimpanan (DM-061) + GC (DM-062).
const read = (doc: Y.Doc) => SiteDocumentSchema.parse(yDocToJson(doc));
const user = userOrigin("sesi-storage");

function recordUpdates(doc: Y.Doc): Uint8Array[] {
  const updates: Uint8Array[] = [];
  doc.on("update", (update: Uint8Array) => updates.push(update));
  return updates;
}

const setGap = (doc: Y.Doc, id: string, value: number) =>
  runOp({ doc, origin: user }, updateStyle, { ids: [id], patch: { layout: { gap: { value, unit: "px" } } } });

describe("snapshot + update (DM-061)", () => {
  it("snapshot state + update sesudahnya = state dokumen hidup (termasuk update yang tumpang tindih)", () => {
    const live = jsonToYDoc(heroDocument());
    const updates = recordUpdates(live);
    setGap(live, "n_hero000001", 4);
    const snapshot = Y.encodeStateAsUpdate(live);
    const coveredCount = updates.length;
    runOp({ doc: live, origin: user }, createNode, { parentId: "n_hero000001", type: "frame", name: "Baru" });
    setGap(live, "n_hero000001", 8);

    const expected = read(live);
    expect(read(loadDocument(snapshot, updates.slice(coveredCount)))).toEqual(expected);
    // Update yang sudah tercakup snapshot aman diulang (idempoten).
    expect(read(loadDocument(snapshot, updates))).toEqual(expected);
    expect(read(loadDocument(compactState(snapshot, updates.slice(coveredCount)), []))).toEqual(expected);
    expect(loadDocument(snapshot, [], "0199f0aa-0000-7000-8000-000000000001").guid).toBe(
      "0199f0aa-0000-7000-8000-000000000001",
    );
  });

  it("ukuran state setelah update dihitung tanpa menyentuh dokumen (batas DM-076)", () => {
    const live = jsonToYDoc(heroDocument());
    const state = Y.encodeStateAsUpdate(live);
    const updates = recordUpdates(live);
    setGap(live, "n_hero000001", 4);
    const { bytes, limit } = stateSizeAfterUpdate(state, updates[0] ?? new Uint8Array());
    expect(bytes).toBeGreaterThan(state.byteLength);
    expect(limit).toBeNull();
  });

  it("muat 5.000 node < 500 ms (AC DM-061, indikatif)", () => {
    const state = Y.encodeStateAsUpdate(jsonToYDoc(generateLandingDocument({ nodeCount: 5000 })));
    let fastest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      loadDocument(state, []).destroy();
      fastest = Math.min(fastest, performance.now() - start);
    }
    expect(fastest).toBeLessThan(500);
  });
});

describe("GC (DM-062)", () => {
  it("10.000 edit acak + compaction → state ≤ 3× JSON; compaction membuang konten terhapus", () => {
    const live = jsonToYDoc(landing200());
    const updates = recordUpdates(live);
    const base = Y.encodeStateAsUpdate(live);
    const frames = Object.values(read(live).nodes)
      .filter((node) => node.type === "frame")
      .map((node) => node.id);
    let seed = 42;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const created: string[] = [];
    for (let i = 0; i < 10_000; i++) {
      const roll = random();
      if (roll < 0.1) {
        const result = runOp({ doc: live, origin: user }, createNode, {
          parentId: frames[Math.floor(random() * frames.length)] ?? "pg_bench00001",
          type: "text",
        });
        if (result.ok) created.push(result.value);
      } else if (roll < 0.18 && created.length > 0) {
        const id = created.splice(Math.floor(random() * created.length), 1)[0];
        if (id) runOp({ doc: live, origin: user }, deleteNodes, { ids: [id] });
      } else {
        const id = frames[Math.floor(random() * frames.length)];
        if (id) setGap(live, id, Math.floor(random() * 64));
      }
    }

    const compacted = compactState(base, updates);
    const jsonBytes = new TextEncoder().encode(JSON.stringify(read(live))).byteLength;
    expect(compacted.byteLength / jsonBytes).toBeLessThanOrEqual(3);
    expect(compacted.byteLength).toBeLessThan(Y.mergeUpdates([base, ...updates]).byteLength);
    expect(read(loadDocument(compacted, []))).toEqual(read(live));
  });
});

describe("snapshot JSON (DM-061)", () => {
  it("valid → dokumen tervalidasi; rusak → tetap dikembalikan dengan invalid: true (tidak melempar)", () => {
    const doc = jsonToYDoc(heroDocument());
    expect(createJsonSnapshot(doc)).toEqual({ json: heroDocument(), invalid: false });

    doc.getMap<unknown>(YDOC_KEYS.nodes).delete("n_hero000001");
    const broken = createJsonSnapshot(doc);
    expect(broken.invalid).toBe(true);
    if (!broken.invalid) throw new Error("harus invalid");
    expect(broken.issues.length).toBeGreaterThan(0);
    expect(broken.json).toMatchObject({ meta: { title: "Toko Kue Budi" } });
  });
});

describe("restoreDocument (diff-apply)", () => {
  it("mengembalikan dokumen ke snapshot sebagai satu transaksi system; replika ikut sinkron; user tidak bisa undo", () => {
    const live = jsonToYDoc(heroDocument());
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(live));
    live.on("update", (update: Uint8Array) => Y.applyUpdate(peer, update));
    const undo = createDocumentUndoManager(live, [user], { captureTimeout: 0 });
    const version1 = read(live);

    runOp({ doc: live, origin: user }, createNode, { parentId: "n_hero000001", type: "frame", name: "Baru" });
    runOp({ doc: live, origin: user }, deleteNodes, { ids: ["n_heroimg001"] });
    setGap(live, "n_hero000001", 99);
    live.transact(() => live.getMap<unknown>(YDOC_KEYS.settings).set("manualResponsive", true), user);

    const transactions: unknown[] = [];
    live.on("afterTransaction", (transaction: Y.Transaction) => transactions.push(transaction.origin));
    const stackBefore = undo.undoStack.length;
    restoreDocument(live, version1, systemOrigin("import"));

    expect(read(live)).toEqual(version1);
    expect(read(peer)).toEqual(version1);
    expect(transactions).toEqual([systemOrigin("import")]);
    expect(undo.undoStack).toHaveLength(stackBefore);
  });

  it("granular: teks yang tidak berubah mempertahankan Y.XmlFragment yang sama; restore idempoten", () => {
    const live = jsonToYDoc(heroDocument());
    const fragment = () => {
      const yProps = live.getMap<Y.Map<unknown>>(YDOC_KEYS.nodes).get("n_herottl001")?.get("props");
      return (yProps as Y.Map<unknown> | undefined)?.get("content");
    };
    const before = fragment();
    setGap(live, "n_hero000001", 99);
    restoreDocument(live, heroDocument(), systemOrigin("import"));
    expect(fragment()).toBe(before);

    const updates = recordUpdates(live);
    restoreDocument(live, heroDocument(), systemOrigin("import"));
    expect(updates).toHaveLength(0);
  });

  it("teks yang berubah diganti; tipe node berbeda diganti utuh", () => {
    const target = heroDocument();
    const title = target.nodes.n_herottl001;
    if (title?.type !== "text") throw new Error("fixture berubah");
    title.props.content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Judul baru" }] }],
    };
    const live = jsonToYDoc(heroDocument());
    restoreDocument(live, target, systemOrigin("import"));
    expect(read(live)).toEqual(target);
  });
});
