import { createNode, deleteNodes, jsonToYDoc, moveNode, runOp, updateStyle } from "@platform/document-model";
import { NodeStore } from "../document/node-store";
import { cameraStore } from "./camera-store";
import { fixtureFromSearch } from "./dev-fixture";
import { spikeGeometry } from "./geometry/spike-geometry";
import { isSelectablePath } from "./hit-test/hit-test";
import { hitTestCanvas } from "./hit-test/spike-hit-test";

// SEMENTARA (spike M0): satu Y.Doc dari fixture untuk seluruh editor. Lifecycle Y.Doc sungguhan
// (IndexedDB → Hocuspocus) menyusul di M1 (T1.15.7).
const fixture = fixtureFromSearch(window.location.search);

export const spikeDoc = jsonToYDoc(fixture);
export const spikeNodeStore = new NodeStore(spikeDoc);
export const spikePageId = fixture.pageOrder[0] ?? "";

// ED-019: transaksi dokumen bisa menggeser node tanpa mengubah ukurannya → ukur ulang semua (lazy).
spikeDoc.on("afterTransaction", () => spikeGeometry.invalidateAll());

// ED-020: node terkunci (atau ancestor-nya terkunci) tidak bisa dipilih di canvas.
export const isSelectable = (path: readonly string[]) =>
  isSelectablePath(path, (id) => spikeNodeStore.getNode(id)?.locked === true);

export function spikeHitTest(clientX: number, clientY: number) {
  const world = document.getElementById("world");
  return world ? hitTestCanvas(world, clientX, clientY, isSelectable) : null;
}

// Origin lokal untuk UndoManager (T0.7.1).
export const LOCAL_ORIGIN = { kind: "user", sessionId: "local" } as const;

// Dev saja: ubah dokumen dari console browser untuk cek manual render inkremental, mis.
// __spike.run(__spike.ops.updateStyle, { ids: ["n_0000000a"], patch: { fills: [{ type: "solid", color: "#FF0000" }] } })
if (import.meta.env.DEV) {
  Object.assign(window, {
    __spike: {
      doc: spikeDoc,
      ops: { createNode, moveNode, updateStyle, deleteNodes },
      run: (op: Parameters<typeof runOp>[1], input: unknown) => runOp({ doc: spikeDoc, origin: LOCAL_ORIGIN }, op, input),
      // Dipakai E2E & benchmark spike (T0.4.6, T0.7.3).
      camera: cameraStore,
      geometry: spikeGeometry,
      hitTest: (clientX: number, clientY: number) => spikeHitTest(clientX, clientY)?.nodeId ?? null,
      hit: spikeHitTest,
    },
  });
}
