import {
  type Breakpoint,
  deleteNodes,
  duplicateNodes,
  runCommand,
  setLocked,
  setVisible,
} from "@platform/document-model";
import type { AlignEdge, DistributeAxis } from "../../canvas/align";
import { applyAlign, applyDistribute } from "../../canvas/align-commands";
import { applyZOrder } from "../../canvas/arrange-commands";
import { removeAutoLayoutFromSelection, toggleAutoLayout } from "../../canvas/auto-layout/apply";
import { zoomStep } from "../../canvas/camera-commands";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { zoomTo100, zoomToFit, zoomToSelection } from "../../canvas/fit-commands";
import { breakpointStore } from "../../store/breakpoint-store";
import { nodeLinkStore } from "../../store/node-link-store";
import { previewModeStore } from "../../store/preview-mode-store";
import { selectionStore } from "../../store/selection-store";
import { type LeftTab, uiPreferencesStore } from "../../store/ui-preferences";

// ED-204: aksi command palette. Setiap aksi merujuk binding registry (judul + shortcut) lewat `id`, dan menjalankan
// perilaku yang sama dengan shortcut-nya (satu sumber perilaku). `enabled` menyembunyikan aksi yang butuh seleksi
// saat tidak relevan (spec: perintah tak tersedia disembunyikan).

export interface PaletteAction {
  id: string;
  run(runtime: CanvasRuntime): void;
  enabled?(runtime: CanvasRuntime): boolean;
}

const sel = () => selectionStore.getState().selectedIds;
const hasSelection = () => sel().length > 0;
const ctxOf = (runtime: CanvasRuntime) => ({ doc: runtime.doc, origin: runtime.origin });

function toggleLockHide(runtime: CanvasRuntime, which: "lock" | "hide"): void {
  const ids = sel();
  if (ids.length === 0) return;
  runtime.undo.stopCapturing();
  if (which === "lock") {
    const lock = !ids.every((id) => runtime.nodeStore.getNode(id)?.locked === true);
    runCommand(ctxOf(runtime), setLocked, { ids: [...ids], locked: lock });
  } else {
    const hide = ids.every((id) => runtime.nodeStore.getNode(id)?.visible !== false);
    runCommand(ctxOf(runtime), setVisible, { ids: [...ids], visible: !hide });
  }
}

const setBreakpoint = (bp: Breakpoint) => breakpointStore.getState().setActive(bp);
const openPanel = (tab: LeftTab, pagesOpen = false) =>
  uiPreferencesStore.getState().update({ leftTab: tab, pagesOpen, leftCollapsed: false });

const alignAction = (id: string, edge: AlignEdge): PaletteAction => ({
  id,
  enabled: hasSelection,
  run: (runtime) => applyAlign(runtime, sel(), edge),
});
const distributeAction = (id: string, axis: DistributeAxis): PaletteAction => ({
  id,
  enabled: () => sel().length >= 3,
  run: (runtime) => applyDistribute(runtime, sel(), axis),
});

export const PALETTE_ACTIONS: readonly PaletteAction[] = [
  { id: "edit.undo", run: (r) => r.undo.undo(), enabled: (r) => r.undo.canUndo() },
  { id: "edit.redo", run: (r) => r.undo.redo(), enabled: (r) => r.undo.canRedo() },
  {
    id: "edit.duplicate",
    enabled: hasSelection,
    run: (r) => {
      r.undo.stopCapturing();
      runCommand(ctxOf(r), duplicateNodes, { ids: [...sel()] });
    },
  },
  {
    id: "edit.delete",
    enabled: hasSelection,
    run: (r) => {
      r.undo.stopCapturing();
      runCommand(ctxOf(r), deleteNodes, { ids: [...sel()] });
    },
  },
  { id: "edit.lock", enabled: hasSelection, run: (r) => toggleLockHide(r, "lock") },
  { id: "edit.hide", enabled: hasSelection, run: (r) => toggleLockHide(r, "hide") },
  { id: "layout.addAuto", enabled: hasSelection, run: (r) => toggleAutoLayout(r, sel()) },
  { id: "layout.removeAuto", enabled: hasSelection, run: (r) => removeAutoLayoutFromSelection(r, sel()) },
  alignAction("align.left", "left"),
  alignAction("align.center", "hcenter"),
  alignAction("align.right", "right"),
  alignAction("align.top", "top"),
  alignAction("align.middle", "vcenter"),
  alignAction("align.bottom", "bottom"),
  distributeAction("distribute.h", "horizontal"),
  distributeAction("distribute.v", "vertical"),
  { id: "arrange.forward", enabled: () => sel().length === 1, run: (r) => applyZOrder(r, "forward") },
  { id: "arrange.backward", enabled: () => sel().length === 1, run: (r) => applyZOrder(r, "backward") },
  { id: "arrange.front", enabled: () => sel().length === 1, run: (r) => applyZOrder(r, "front") },
  { id: "arrange.back", enabled: () => sel().length === 1, run: (r) => applyZOrder(r, "back") },
  { id: "node.addLink", enabled: () => sel().length === 1, run: () => nodeLinkStore.getState().requestOpen() },
  { id: "view.preview", run: () => previewModeStore.getState().toggle() },
  { id: "zoom.in", run: () => zoomStep("in") },
  { id: "zoom.out", run: () => zoomStep("out") },
  { id: "zoom.fit", run: (r) => zoomToFit(r) },
  { id: "zoom.selection", enabled: hasSelection, run: (r) => zoomToSelection(r) },
  { id: "zoom.100", run: () => zoomTo100() },
  { id: "breakpoint.desktop", run: () => setBreakpoint("base") },
  { id: "breakpoint.tablet", run: () => setBreakpoint("tablet") },
  { id: "breakpoint.mobile", run: () => setBreakpoint("mobile") },
  { id: "panel.layers", run: () => openPanel("layers") },
  { id: "panel.assets", run: () => openPanel("assets") },
  { id: "panel.insert", run: () => openPanel("insert") },
  { id: "panel.pages", run: () => openPanel("layers", true) },
];
