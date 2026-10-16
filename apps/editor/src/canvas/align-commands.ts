import { resolveStyle, runCommand, updateStyle } from "@platform/document-model";
import {
  type AlignEdge,
  alignDeltas,
  type Box,
  type Delta,
  type DistributeAxis,
  distributeDeltas,
  unionBounds,
} from "./align";
import type { CanvasRuntime } from "./canvas-runtime";

// ED-072: terapkan align/distribute pada seleksi. Hanya node absolute (freeform) yang digeser; align child
// auto-layout (mengubah alignment parent) menyusul. Dipakai shortcut keyboard & tombol toolbar inspector.

// Node absolute terseleksi beserta rect world-nya.
function absoluteBoxes(runtime: CanvasRuntime, selectedIds: readonly string[]): Box[] {
  const boxes: Box[] = [];
  for (const id of selectedIds) {
    const node = runtime.nodeStore.getNode(id);
    if (!node || node.locked) continue;
    if (resolveStyle(node.style, "base").position?.type !== "absolute") continue;
    const rect = runtime.geometry.store.peekRect(id);
    if (rect) boxes.push({ id, rect });
  }
  return boxes;
}

function applyDeltas(runtime: CanvasRuntime, deltas: Map<string, Delta>): void {
  const entries = [...deltas].filter(([, delta]) => delta.dx !== 0 || delta.dy !== 0);
  if (entries.length === 0) return;
  runtime.undo.stopCapturing();
  runtime.doc.transact(() => {
    for (const [id, delta] of entries) {
      const node = runtime.nodeStore.getNode(id);
      const position = node ? resolveStyle(node.style, "base").position : undefined;
      if (position?.type !== "absolute") continue;
      runCommand({ doc: runtime.doc, origin: runtime.origin }, updateStyle, {
        ids: [id],
        patch: { position: { x: position.x + delta.dx, y: position.y + delta.dy } },
      });
    }
  }, runtime.origin);
  runtime.undo.stopCapturing();
}

export function applyAlign(runtime: CanvasRuntime, selectedIds: readonly string[], edge: AlignEdge): void {
  const boxes = absoluteBoxes(runtime, selectedIds);
  if (boxes.length === 0) return;
  // Satu node → relatif ke rect parent; banyak node → relatif ke bounding seleksi.
  let bounds: ReturnType<typeof unionBounds>;
  if (boxes.length === 1) {
    const parentId = runtime.nodeStore.getNode((boxes[0] as Box).id)?.parentId;
    bounds = parentId ? runtime.geometry.store.peekRect(parentId) : null;
  } else {
    bounds = unionBounds(boxes.map((box) => box.rect));
  }
  if (!bounds) return;
  applyDeltas(runtime, alignDeltas(boxes, edge, bounds));
}

export function applyDistribute(runtime: CanvasRuntime, selectedIds: readonly string[], axis: DistributeAxis): void {
  const boxes = absoluteBoxes(runtime, selectedIds);
  if (boxes.length < 3) return;
  applyDeltas(runtime, distributeDeltas(boxes, axis));
}
