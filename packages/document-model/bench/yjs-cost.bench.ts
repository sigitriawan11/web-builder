import { test } from "vitest";
import * as Y from "yjs";
import {
  jsonToYDoc,
  moveNode,
  type OpContext,
  runOp,
  type SiteDocument,
  SiteDocumentSchema,
  updateStyle,
  yDocToJson,
} from "../src";
import { generateLandingDocument } from "../test/fixtures";

// T0.7.5 / DM-061, DM-062, DM-077: biaya Yjs — ukuran (dicetak sebagai tabel) & waktu (Vitest bench).
// Jalankan: `pnpm --filter @platform/document-model bench`. Angka WSL2 = indikatif; resmi di laptop referensi.

const SIZES = [200, 2000, 5000] as const;
const ORIGIN = { kind: "user", sessionId: "bench" };
const encoder = new TextEncoder();
const kb = (bytes: number) => Math.round((bytes / 1024) * 10) / 10;

const fixtures = new Map(SIZES.map((nodeCount) => [nodeCount, generateLandingDocument({ nodeCount })]));
function fixture(nodeCount: number): SiteDocument {
  const doc = fixtures.get(nodeCount as (typeof SIZES)[number]);
  if (!doc) throw new Error(`fixture ${nodeCount} tidak ada`);
  return doc;
}

const nodeIds = (doc: SiteDocument, predicate: (node: SiteDocument["nodes"][string]) => boolean) =>
  Object.values(doc.nodes)
    .filter(predicate)
    .map((node) => node.id);

// Ukuran update biner satu transaksi (yang dikirim ke Hocuspocus per aksi, DM-061).
function updateBytes(ydoc: Y.Doc, run: () => void): number {
  let bytes = 0;
  const listener = (update: Uint8Array) => {
    bytes += update.byteLength;
  };
  ydoc.on("update", listener);
  run();
  ydoc.off("update", listener);
  return bytes;
}

function mustRun(ctx: OpContext, op: Parameters<typeof runOp>[1], input: unknown) {
  const result = runOp(ctx, op, input);
  if (!result.ok) throw new Error(result.error.message);
}

// mulberry32 agar urutan edit acak (DM-062) sama tiap run.
function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function measureSizes() {
  const rows: Record<string, Record<string, number | string>> = {};
  for (const nodeCount of SIZES) {
    const json = fixture(nodeCount);
    const ydoc = jsonToYDoc(json);
    const ctx = { doc: ydoc, origin: ORIGIN };
    const frames = nodeIds(json, (node) => node.type === "frame" && node.parentId !== null);
    const target = frames[Math.floor(frames.length / 2)] ?? "";
    const parentOf = json.nodes[target]?.parentId ?? "";

    // Commit drag (ED-062): satu updateStyle posisi di akhir drag.
    const dragCommit = updateBytes(ydoc, () =>
      mustRun(ctx, updateStyle, { ids: [target], patch: { position: { type: "absolute", x: 120, y: 80 } } }),
    );
    // Pembanding: jika preview ditulis ke Yjs tiap frame (yang sengaja dihindari, ED-024) — 60 frame ≈ 1 detik drag.
    const dragPerFrame = updateBytes(ydoc, () => {
      for (let frame = 0; frame < 60; frame++)
        mustRun(ctx, updateStyle, { ids: [target], patch: { position: { type: "absolute", x: 120 + frame, y: 80 } } });
    });
    const resizeCommit = updateBytes(ydoc, () =>
      mustRun(ctx, updateStyle, {
        ids: [target],
        patch: { size: { width: { mode: "fixed", value: 320, unit: "px" } } },
      }),
    );
    const reorderCommit = updateBytes(ydoc, () =>
      mustRun(ctx, moveNode, { id: target, newParentId: parentOf, index: 0 }),
    );

    const jsonBytes = encoder.encode(JSON.stringify(json)).byteLength;
    const stateBytes = Y.encodeStateAsUpdate(jsonToYDoc(json)).byteLength;
    rows[`${nodeCount} node`] = {
      "JSON KB": kb(jsonBytes),
      "state Yjs KB": kb(stateBytes),
      "state/JSON": Math.round((stateBytes / jsonBytes) * 100) / 100,
      "drag commit B": dragCommit,
      "drag 60 frame ke Yjs B": dragPerFrame,
      "resize commit B": resizeCommit,
      "reorder commit B": reorderCommit,
    };
  }
  return rows;
}

// DM-062 AC: 10.000 edit acak + compaction → state Yjs ≤ 3× JSON snapshot.
function measureAfterEdits(nodeCount: number, edits: number) {
  const ydoc = jsonToYDoc(fixture(nodeCount));
  const ctx = { doc: ydoc, origin: ORIGIN };
  const json = fixture(nodeCount);
  const frames = nodeIds(
    json,
    (node) => node.type === "frame" && node.parentId !== null && node.parentId !== json.pageOrder[0],
  );
  const all = nodeIds(json, (node) => node.parentId !== null);
  const random = rng(7);
  const pick = (ids: string[]) => ids[Math.floor(random() * ids.length)] ?? "";
  for (let i = 0; i < edits; i++) {
    const roll = random();
    const id = pick(all);
    if (roll < 0.4)
      mustRun(ctx, updateStyle, { ids: [id], patch: { position: { type: "absolute", x: i % 500, y: i % 300 } } });
    else if (roll < 0.7)
      mustRun(ctx, updateStyle, {
        ids: [id],
        patch: { fills: [{ type: "solid", color: `#${((i * 2654435761) % 0xffffff).toString(16).padStart(6, "0")}` }] },
      });
    else if (roll < 0.85)
      mustRun(ctx, updateStyle, {
        ids: [id],
        patch: { size: { width: { mode: "fixed", value: 100 + (i % 400), unit: "px" } } },
      });
    else {
      // Pindah ke frame lain; gagal (mis. ke turunannya sendiri) dilewati — op tidak menulis apa pun saat gagal.
      runOp(ctx, moveNode, { id, newParentId: pick(frames), index: 0 });
    }
  }
  // Compaction = state ter-merge dari Y.Doc (gc aktif), seperti document_snapshots.state.
  const stateBytes = Y.encodeStateAsUpdate(ydoc).byteLength;
  const jsonBytes = encoder.encode(JSON.stringify(yDocToJson(ydoc))).byteLength;
  return {
    edits,
    "JSON KB": kb(jsonBytes),
    "state Yjs KB": kb(stateBytes),
    "state/JSON": Math.round((stateBytes / jsonBytes) * 100) / 100,
  };
}

console.log("\nUkuran Yjs per fixture landing (DM-061):");
console.table(measureSizes());
console.log("Setelah edit acak (DM-062, batas state/JSON ≤ 3):");
console.table({ "2000 node": measureAfterEdits(2000, 10_000) });

// Vitest 5: benchmark lewat `context.bench`; `bench.compare` mencetak tabel latensi per ukuran.
for (const nodeCount of SIZES) {
  test(`${nodeCount} node`, async ({ bench }) => {
    const json = fixture(nodeCount);
    const ydoc = jsonToYDoc(json);
    const state = Y.encodeStateAsUpdate(ydoc);

    await bench.compare(
      bench("SiteDocumentSchema.parse (validasi)", () => {
        SiteDocumentSchema.parse(json);
      }),
      bench("jsonToYDoc", () => {
        jsonToYDoc(json);
      }),
      bench("yDocToJson", () => {
        yDocToJson(ydoc);
      }),
      // DM-061 AC: load editor = decode state snapshot (< 500 ms untuk 5.000 node).
      bench("decode state (Y.applyUpdate ke Y.Doc baru)", () => {
        Y.applyUpdate(new Y.Doc(), state);
      }),
      bench("encodeStateAsUpdate", () => {
        Y.encodeStateAsUpdate(ydoc);
      }),
    );
  });
}
