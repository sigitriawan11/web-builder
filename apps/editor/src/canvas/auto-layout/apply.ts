import {
  type CommandStep,
  createNode,
  moveNode,
  type Node,
  reorderNode,
  resolveStyle,
  runCommands,
  step,
  updateStyle,
} from "@platform/document-model";
import { selectionStore } from "../../store/selection-store";
import { showToast } from "../../store/toast-store";
import { unionBounds } from "../align";
import type { CanvasRuntime } from "../canvas-runtime";
import { type ChildRect, inferAutoLayout, type Rect } from "./infer";

// ED-079: tambah/hapus auto-layout (Shift+A / Shift+Alt+A). Memakai geometry (rect world) untuk inferensi &
// keepVisualPosition saat hapus. Semua perubahan satu batch atomik (satu langkah undo).

const px = (value: number) => ({ value, unit: "px" as const });
const ctxOf = (runtime: CanvasRuntime) => ({ doc: runtime.doc, origin: runtime.origin });

function childRects(runtime: CanvasRuntime, ids: readonly string[]): ChildRect[] {
  return ids.flatMap((id) => {
    const rect = runtime.geometry.store.peekRect(id);
    return rect ? [{ id, rect }] : [];
  });
}

const isFrame = (node: Node | null): node is Extract<Node, { type: "frame" }> => node?.type === "frame";
const isFlex = (node: Node) => resolveStyle(node.style, "base").layout?.mode === "flex";

function paddingPatch(padding: { top: number; right: number; bottom: number; left: number }) {
  return { top: px(padding.top), right: px(padding.right), bottom: px(padding.bottom), left: px(padding.left) };
}

// Konversi frame freeform (dengan children) menjadi auto-layout berdasarkan posisi children.
function addAutoLayoutToFrame(runtime: CanvasRuntime, frame: Extract<Node, { type: "frame" }>): void {
  const frameRect = runtime.geometry.store.peekRect(frame.id);
  const children = childRects(runtime, frame.children);
  if (!frameRect || children.length === 0) return;
  const inferred = inferAutoLayout(frameRect, children);
  const isSection = frame.props.role === "section";

  runtime.undo.stopCapturing();
  const steps: CommandStep[] = [];
  inferred.order.forEach((childId, index) => {
    steps.push(step(reorderNode, { id: childId, index }));
    steps.push(step(updateStyle, { ids: [childId], patch: { position: { type: "flow" } } }));
  });
  steps.push(
    step(updateStyle, {
      ids: [frame.id],
      patch: {
        layout: {
          mode: "flex",
          direction: inferred.direction,
          gap: px(inferred.gap),
          padding: paddingPatch(inferred.padding),
        },
        // Frame auto-layout meng-hug kontennya; section tetap selebar halaman.
        size: { width: isSection ? { mode: "fill" } : { mode: "hug" }, height: { mode: "hug" } },
      },
    }),
  );
  runCommands(ctxOf(runtime), steps);
  runtime.undo.stopCapturing();
}

// Bungkus node terseleksi (parent sama) dalam frame auto-layout baru di posisi bounding box seleksi.
function wrapInAutoLayout(runtime: CanvasRuntime, nodeIds: readonly string[]): void {
  const first = runtime.nodeStore.getNode(nodeIds[0] ?? "");
  const parentId = first?.parentId;
  if (!parentId) return;
  const parentRect = runtime.geometry.store.peekRect(parentId);
  const children = childRects(runtime, nodeIds);
  const bounds = unionBounds(children.map((c) => c.rect));
  if (!parentRect || !bounds || children.length === 0) return;

  // Inferensi relatif bounding box (frame baru = bbox → padding rapat).
  const inferred = inferAutoLayout(bounds, children);
  const local: Rect = {
    x: bounds.x - parentRect.x,
    y: bounds.y - parentRect.y,
    width: bounds.width,
    height: bounds.height,
  };
  const parent = runtime.nodeStore.getNode(parentId);
  const insertIndex =
    parent && "children" in parent
      ? Math.min(...nodeIds.map((id) => parent.children.indexOf(id)).filter((i) => i >= 0))
      : 0;

  runtime.undo.stopCapturing();
  const result = runCommands(ctxOf(runtime), (results) => {
    if (results.length === 0) {
      return step(createNode, {
        parentId,
        index: insertIndex,
        type: "frame",
        style: {
          base: {
            position: { type: "absolute", x: Math.round(local.x), y: Math.round(local.y) },
            size: { width: { mode: "hug" }, height: { mode: "hug" } },
            layout: {
              mode: "flex",
              direction: inferred.direction,
              gap: px(inferred.gap),
              padding: paddingPatch(inferred.padding),
            },
          },
        },
      });
    }
    const frameId = results[0] as string;
    // Pindahkan tiap child (urut inferensi) ke frame baru sebagai anak flow.
    const moves: CommandStep[] = inferred.order.flatMap((id, index) => [
      step(moveNode, { id, newParentId: frameId, index }),
      step(updateStyle, { ids: [id], patch: { position: { type: "flow" } } }),
    ]);
    return moves[results.length - 1] ?? null;
  });
  runtime.undo.stopCapturing();
  if (result.ok) selectionStore.getState().select([result.value[0] as string]);
}

// Hapus auto-layout: frame kembali freeform; children dikonversi ke absolute agar posisi visual tetap.
function removeAutoLayout(runtime: CanvasRuntime, frame: Extract<Node, { type: "frame" }>): void {
  const frameRect = runtime.geometry.store.peekRect(frame.id);
  const children = childRects(runtime, frame.children);
  if (!frameRect) return;

  runtime.undo.stopCapturing();
  const steps: CommandStep[] = children.map((child) =>
    step(updateStyle, {
      ids: [child.id],
      patch: {
        position: {
          type: "absolute",
          x: Math.round(child.rect.x - frameRect.x),
          y: Math.round(child.rect.y - frameRect.y),
        },
      },
    }),
  );
  steps.push(step(updateStyle, { ids: [frame.id], patch: { layout: { mode: "none" } } }));
  runCommands(ctxOf(runtime), steps);
  runtime.undo.stopCapturing();
}

// Shift+A: tambah/bungkus auto-layout sesuai seleksi.
export function toggleAutoLayout(runtime: CanvasRuntime, selectedIds: readonly string[]): void {
  if (selectedIds.length === 0) return;
  if (selectedIds.length === 1) {
    const node = runtime.nodeStore.getNode(selectedIds[0] as string);
    if (!node || node.locked) return;
    if (isFrame(node)) {
      // Frame freeform dengan anak → jadi auto-layout; frame flex/kosong → tak ada efek.
      if (node.children.length > 0 && !isFlex(node)) addAutoLayoutToFrame(runtime, node);
      return;
    }
    wrapInAutoLayout(runtime, selectedIds);
    return;
  }
  // Multi-seleksi: harus parent sama.
  const parents = new Set(selectedIds.map((id) => runtime.nodeStore.getNode(id)?.parentId ?? null));
  if (parents.size !== 1 || parents.has(null)) {
    showToast("autoLayout.sameParentRequired", "warning");
    return;
  }
  wrapInAutoLayout(runtime, selectedIds);
}

// Shift+Alt+A: hapus auto-layout dari frame terseleksi.
export function removeAutoLayoutFromSelection(runtime: CanvasRuntime, selectedIds: readonly string[]): void {
  if (selectedIds.length !== 1) return;
  const node = runtime.nodeStore.getNode(selectedIds[0] as string);
  if (isFrame(node) && isFlex(node)) removeAutoLayout(runtime, node);
}
