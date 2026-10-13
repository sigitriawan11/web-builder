import { createNode, deleteNodes, jsonToYDoc, moveNode, runOp, updateStyle } from "@platform/document-model";
import { NodeStore } from "../document/node-store";
import { createUndoController } from "../document/undo-controller";
import { interactionStore } from "../store/interaction-store";
import { selectionStore } from "../store/selection-store";
import { resolvePressTarget } from "../tools/select/marquee";
import { type MarqueeContext, marqueeSelection } from "../tools/select/marquee-selection";
import { nodeLookupFrom } from "../tools/select/node-lookup";
import type { PressTarget } from "./interactions/interaction-machine";
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

const spikeLookup = nodeLookupFrom(spikeNodeStore);

// ED-053: node vs area kosong (marquee) bergantung pada seleksi saat ditekan.
export function resolveSpikeTarget(hit: { nodeId: string; path: readonly string[] } | null): PressTarget {
  return resolvePressTarget(hit, selectionStore.getState().selectedIds, spikeLookup);
}

export const spikeMarqueeContext: MarqueeContext = {
  nodeStore: spikeNodeStore,
  geometry: spikeGeometry,
  pageId: spikePageId,
  camera: () => cameraStore.getState(),
  viewportOffset: () => document.getElementById("editor-viewport")?.getBoundingClientRect() ?? { left: 0, top: 0 },
};

// Origin lokal untuk UndoManager (DM-060).
export const LOCAL_ORIGIN = { kind: "user", sessionId: "local" } as const;

// Undo/redo dokumen (ED-197): origin lokal saja, seleksi ikut dipulihkan.
export const spikeUndo = createUndoController(spikeDoc, LOCAL_ORIGIN, {
  get: () => selectionStore.getState().selectedIds,
  restore: (ids) => selectionStore.getState().select(ids),
  exists: (id) => spikeNodeStore.getNode(id) !== null,
});
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
      undo: spikeUndo,
      undoManager: spikeUndo.manager,
      hitTest: (clientX: number, clientY: number) => spikeHitTest(clientX, clientY)?.nodeId ?? null,
      hit: spikeHitTest,
      interaction: interactionStore,
      selection: selectionStore,
      marqueeSelection: (drag: Parameters<typeof marqueeSelection>[0]) => marqueeSelection(drag, spikeMarqueeContext),
    },
  });
}
