import type { TxOrigin } from "@platform/document-model";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { createContext, useContext } from "react";
import type * as Y from "yjs";
import { NodeStore } from "../document/node-store";
import { createUndoController, type UndoController } from "../document/undo-controller";
import { selectionStore } from "../store/selection-store";
import { resolvePressTarget } from "../tools/select/marquee";
import type { MarqueeContext } from "../tools/select/marquee-selection";
import { nodeLookupFrom } from "../tools/select/node-lookup";
import { cameraStore } from "./camera-store";
import { createDomGeometry, type DomGeometry } from "./geometry/dom-geometry";
import { hitTestCanvas } from "./hit-test/canvas-hit-test";
import { type HitResult, isSelectablePath } from "./hit-test/hit-test";
import type { PressTarget } from "./interactions/interaction-machine";

/**
 * Semua yang dibutuhkan canvas untuk SATU dokumen & page (pengganti singleton spike M0): node store, geometry,
 * undo, hit-test, konteks marquee. Dibuat per dokumen terbuka (playground fixture atau dokumen situs), di-destroy
 * saat dokumen ditutup.
 */
export interface CanvasRuntime {
  doc: Y.Doc;
  // Origin transaksi lokal user ini (DM-060) — dilacak UndoManager.
  origin: Extract<TxOrigin, { kind: "user" }>;
  pageId: string;
  nodeStore: NodeStore;
  geometry: DomGeometry;
  undo: UndoController;
  isSelectable(path: readonly string[]): boolean;
  hitTest(clientX: number, clientY: number): HitResult | null;
  resolveTarget(hit: { nodeId: string; path: readonly string[] } | null): PressTarget;
  marquee: MarqueeContext;
  destroy(): void;
}

export function createCanvasRuntime(options: {
  doc: Y.Doc;
  pageId: string;
  origin: Extract<TxOrigin, { kind: "user" }>;
}): CanvasRuntime {
  const { doc, pageId, origin } = options;
  const nodeStore = new NodeStore(doc);
  const geometry = createDomGeometry();
  // ED-019: transaksi dokumen bisa menggeser node tanpa mengubah ukurannya → ukur ulang semua (lazy).
  const onTransaction = () => geometry.store.invalidateAll();
  doc.on("afterTransaction", onTransaction);

  // ED-020: node terkunci (atau ancestor-nya terkunci) tidak bisa dipilih di canvas.
  const isSelectable = (path: readonly string[]) =>
    isSelectablePath(path, (id) => nodeStore.getNode(id)?.locked === true);
  const lookup = nodeLookupFrom(nodeStore);

  // Undo/redo dokumen (ED-197): origin lokal saja (command canvas + ketikan Tiptap), seleksi ikut dipulihkan.
  const undo = createUndoController(doc, [origin, ySyncPluginKey], {
    get: () => selectionStore.getState().selectedIds,
    restore: (ids) => selectionStore.getState().select(ids),
    exists: (id) => nodeStore.getNode(id) !== null,
  });

  return {
    doc,
    origin,
    pageId,
    nodeStore,
    geometry,
    undo,
    isSelectable,
    hitTest(clientX, clientY) {
      const world = document.getElementById("world");
      return world ? hitTestCanvas(world, clientX, clientY, isSelectable) : null;
    },
    // ED-053: node vs area kosong (marquee) bergantung pada seleksi saat ditekan.
    resolveTarget: (hit) => resolvePressTarget(hit, selectionStore.getState().selectedIds, lookup),
    marquee: {
      nodeStore,
      geometry: geometry.store,
      pageId,
      camera: () => cameraStore.getState(),
      viewportOffset: () => document.getElementById("editor-viewport")?.getBoundingClientRect() ?? { left: 0, top: 0 },
    },
    destroy() {
      doc.off("afterTransaction", onTransaction);
      undo.destroy();
      geometry.destroy();
      nodeStore.destroy();
    },
  };
}

export const CanvasRuntimeContext = createContext<CanvasRuntime | null>(null);

export function useCanvasRuntime(): CanvasRuntime {
  const runtime = useContext(CanvasRuntimeContext);
  if (!runtime) throw new Error("useCanvasRuntime dipakai di luar CanvasRuntimeContext.Provider");
  return runtime;
}
