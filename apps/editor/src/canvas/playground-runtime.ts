import { createNode, deleteNodes, jsonToYDoc, moveNode, runCommand, updateStyle } from "@platform/document-model";
import { interactionStore } from "../store/interaction-store";
import { selectionStore } from "../store/selection-store";
import { marqueeSelection } from "../tools/select/marquee-selection";
import { cameraStore } from "./camera-store";
import { type CanvasRuntime, createCanvasRuntime } from "./canvas-runtime";
import { fixtureFromSearch } from "./dev-fixture";

// Origin lokal playground untuk UndoManager (DM-060).
export const LOCAL_ORIGIN = { kind: "user", sessionId: "local" } as const;

/**
 * Playground canvas M0 (dev saja, `/editor/`): dokumen dari fixture `?fixture=` — dipakai e2e canvas & benchmark.
 * Editor situs memakai runtime yang sama untuk dokumen dari realtime (SiteEditor).
 */
export function createPlaygroundRuntime(search: string): CanvasRuntime {
  const fixture = fixtureFromSearch(search);
  const runtime = createCanvasRuntime({
    doc: jsonToYDoc(fixture),
    pageId: fixture.pageOrder[0] ?? "",
    origin: LOCAL_ORIGIN,
  });
  exposeDevApi(runtime);
  return runtime;
}

// Dev saja: ubah dokumen dari console browser untuk cek manual render inkremental, mis.
// __spike.run(__spike.ops.updateStyle, { ids: ["n_0000000a"], patch: { fills: [{ type: "solid", color: "#FF0000" }] } })
export function exposeDevApi(runtime: CanvasRuntime): void {
  if (!import.meta.env.DEV) return;
  Object.assign(window, {
    __spike: {
      doc: runtime.doc,
      ops: { createNode, moveNode, updateStyle, deleteNodes },
      run: (op: Parameters<typeof runCommand>[1], input: unknown) =>
        runCommand({ doc: runtime.doc, origin: runtime.origin }, op, input),
      // Dipakai E2E & benchmark canvas (T0.4.6, T0.7.3).
      camera: cameraStore,
      geometry: runtime.geometry.store,
      undo: runtime.undo,
      undoManager: runtime.undo.manager,
      hitTest: (clientX: number, clientY: number) => runtime.hitTest(clientX, clientY)?.nodeId ?? null,
      hit: runtime.hitTest,
      interaction: interactionStore,
      selection: selectionStore,
      marqueeSelection: (drag: Parameters<typeof marqueeSelection>[0]) => marqueeSelection(drag, runtime.marquee),
    },
  });
}
