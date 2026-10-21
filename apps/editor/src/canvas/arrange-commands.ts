import { reorderNode, runCommand } from "@platform/document-model";
import { selectionStore } from "../store/selection-store";
import type { CanvasRuntime } from "./canvas-runtime";
import { type ZOrderOp, zOrderIndex } from "./section-order";

// ED-091 z-order: pindah satu node terseleksi dalam urutan anak (urutan DOM = stacking). Dipakai shortcut
// (use-section-shortcuts), command palette, dan context menu — satu sumber perilaku.
export function applyZOrder(runtime: CanvasRuntime, op: ZOrderOp): void {
  const ids = selectionStore.getState().selectedIds;
  if (ids.length !== 1) return;
  const id = ids[0] as string;
  const node = runtime.nodeStore.getNode(id);
  const parent = node?.parentId ? runtime.nodeStore.getNode(node.parentId) : null;
  if (!node || !parent || !("children" in parent)) return;
  const to = zOrderIndex(parent.children.length, parent.children.indexOf(id), op);
  if (to === null) return;
  runtime.undo.stopCapturing();
  runCommand(runtime.commandCtx, reorderNode, { id, index: to });
  runtime.undo.stopCapturing();
}
