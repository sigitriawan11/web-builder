import type { CommandContext, TxOrigin } from "@platform/document-model";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { createContext, useContext } from "react";
import type * as Y from "yjs";
import type { ZodTypeAny } from "zod";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import { NodeStore, type NodeValidator } from "../document/node-store";
import { createUndoController, type UndoController } from "../document/undo-controller";
import { selectionStore } from "../store/selection-store";
import { syncUiWithDocument } from "../store/selection-sync";
import { recordEditorAction } from "../telemetry/telemetry";
import { resolvePressTarget } from "../tools/select/marquee";
import type { MarqueeContext } from "../tools/select/marquee-selection";
import { nodeLookupFrom } from "../tools/select/node-lookup";
import { cameraStore } from "./camera-store";
import type { CameraState } from "./geometry/coordinates";
import { createDomGeometry, type DomGeometry } from "./geometry/dom-geometry";
import { hitTestCanvas } from "./hit-test/canvas-hit-test";
import { type HitResult, isSelectablePath } from "./hit-test/hit-test";
import type { PressTarget } from "./interactions/interaction-machine";

/**
 * Semua yang dibutuhkan canvas untuk SATU dokumen (pengganti singleton spike M0): node store, geometry, undo,
 * hit-test, konteks marquee. Dibuat per dokumen terbuka (playground fixture atau dokumen situs), di-destroy saat
 * dokumen ditutup. Page aktif bisa diganti (`setPage`) tanpa membuat ulang runtime — stack undo tetap satu per
 * dokumen (ED-197), kamera terakhir tiap page diingat (ED-032).
 */
export interface CanvasRuntime {
  doc: Y.Doc;
  // Origin transaksi lokal user ini (DM-060) — dilacak UndoManager.
  origin: Extract<TxOrigin, { kind: "user" }>;
  // Konteks command siap pakai (doc+origin+nodeSchema). Semua pemanggil runCommand memakai ini agar pasca-cek
  // dokumen component (ComponentNodeSchema) tidak memakai schema node situs (Mode Admin, CMP-010).
  commandCtx: CommandContext;
  /** Page aktif saat ini (baca saat dipakai; komponen React memakai `usePageId`). */
  readonly pageId: string;
  readonly page: StoreApi<{ pageId: string }>;
  setPage(pageId: string): void;
  nodeStore: NodeStore;
  geometry: DomGeometry;
  undo: UndoController;
  isSelectable(path: readonly string[]): boolean;
  hitTest(clientX: number, clientY: number): HitResult | null;
  resolveTarget(hit: { nodeId: string; path: readonly string[] } | null): PressTarget;
  marquee: MarqueeContext;
  // ED-229: sesi read-only (lock user lain / akses dicabut) — canvas & shortcut tidak boleh mengubah dokumen.
  isReadOnly(): boolean;
  setReadOnly(readOnly: boolean): void;
  destroy(): void;
}

function originKind(origin: unknown): string {
  if (typeof origin === "object" && origin !== null && "kind" in origin && typeof origin.kind === "string") {
    return origin.kind;
  }
  return "other";
}

export function createCanvasRuntime(options: {
  doc: Y.Doc;
  pageId: string;
  origin: Extract<TxOrigin, { kind: "user" }>;
  // Mode Admin menyuntik `ComponentNodeSchema` (default = schema node situs). Dipakai NodeStore (validasi boundary)
  // DAN pasca-cek command (lewat `commandCtx`).
  nodeSchema?: ZodTypeAny;
}): CanvasRuntime {
  const { doc, pageId, origin } = options;
  const nodeStore = new NodeStore(doc, options.nodeSchema as NodeValidator | undefined);
  const commandCtx: CommandContext = { doc, origin, ...(options.nodeSchema ? { nodeSchema: options.nodeSchema } : {}) };
  const page = createStore<{ pageId: string }>()(() => ({ pageId }));
  const cameras = new Map<string, CameraState>();
  const geometry = createDomGeometry();
  // ED-019: transaksi dokumen bisa menggeser node tanpa mengubah ukurannya → ukur ulang semua (lazy).
  const onTransaction = (transaction: Y.Transaction) => {
    geometry.store.invalidateAll();
    // ED-231: jejak transaksi dokumen untuk Sentry — hanya jenis origin, tanpa isi.
    if (transaction.local) recordEditorAction("transaction", originKind(transaction.origin));
  };
  doc.on("afterTransaction", onTransaction);

  // ED-020: node terkunci (atau ancestor-nya terkunci) tidak bisa dipilih di canvas.
  const isSelectable = (path: readonly string[]) =>
    isSelectablePath(path, (id) => nodeStore.getNode(id)?.locked === true);
  const lookup = nodeLookupFrom(nodeStore);

  // Undo/redo dokumen (ED-197): origin lokal saja (command canvas + ketikan Tiptap), seleksi ikut dipulihkan.
  const exists = (id: string) => nodeStore.getNode(id) !== null;
  const undo = createUndoController(doc, [origin, ySyncPluginKey], {
    get: () => selectionStore.getState().selectedIds,
    restore: (ids) => selectionStore.getState().select(ids),
    exists,
  });
  const stopUiSync = syncUiWithDocument(doc, exists);
  let readOnly = false;

  const marquee: MarqueeContext = {
    nodeStore,
    geometry: geometry.store,
    get pageId() {
      return page.getState().pageId;
    },
    camera: () => cameraStore.getState(),
    viewportOffset: () => document.getElementById("editor-viewport")?.getBoundingClientRect() ?? { left: 0, top: 0 },
  };

  return {
    doc,
    origin,
    commandCtx,
    get pageId() {
      return page.getState().pageId;
    },
    page,
    setPage(next) {
      const current = page.getState().pageId;
      if (next === current) return;
      const { x, y, zoom } = cameraStore.getState();
      cameras.set(current, { x, y, zoom });
      selectionStore.getState().clear();
      page.setState({ pageId: next });
      cameraStore.getState().setCamera(cameras.get(next) ?? { x: 0, y: 0, zoom: 1 });
    },
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
    marquee,
    isReadOnly: () => readOnly,
    setReadOnly: (next) => {
      readOnly = next;
    },
    destroy() {
      doc.off("afterTransaction", onTransaction);
      stopUiSync();
      undo.destroy();
      geometry.destroy();
      nodeStore.destroy();
    },
  };
}

/** Page aktif runtime untuk komponen React (render ulang saat page berganti). */
export function usePageId(runtime: CanvasRuntime): string {
  return useStore(runtime.page, (state) => state.pageId);
}

export const CanvasRuntimeContext = createContext<CanvasRuntime | null>(null);

export function useCanvasRuntime(): CanvasRuntime {
  const runtime = useContext(CanvasRuntimeContext);
  if (!runtime) throw new Error("useCanvasRuntime dipakai di luar CanvasRuntimeContext.Provider");
  return runtime;
}
