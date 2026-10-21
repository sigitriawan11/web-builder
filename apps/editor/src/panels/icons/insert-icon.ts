import { createNode, runCommand } from "@platform/document-model";
import { cameraStore } from "../../canvas/camera-store";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { screenPoint, screenToWorld } from "../../canvas/geometry/coordinates";
import { selectionStore } from "../../store/selection-store";

// Sisip node `icon` Lucide (ED-046/ED-163). Dipakai Icon tool (popover) & tab Assets → Icons. Caller yang memutuskan
// apa yang terjadi setelahnya (ganti tool / tutup popover).

export const ICON_SIZE = 24;

// ED-037: posisi absolute untuk ikon di parent freeform — ditaruh di tengah viewport (lokal parent), di-clamp ke
// dalam parent bila sudah terukur. Tanpa ini ikon jadi flow child di parent non-flex → tidak bisa digeser (hanya
// resize), karena drag-move butuh `position.absolute` dan reorder butuh parent auto-layout.
function freeformPosition(runtime: CanvasRuntime, parentId: string): { type: "absolute"; x: number; y: number } {
  const viewport = document.getElementById("editor-viewport")?.getBoundingClientRect();
  const offset = { left: viewport?.left ?? 0, top: viewport?.top ?? 0 };
  const center = screenPoint(offset.left + (viewport?.width ?? 0) / 2, offset.top + (viewport?.height ?? 0) / 2);
  const world = screenToWorld(center, cameraStore.getState(), offset);
  const parentRect = runtime.geometry.store.getRect(parentId);
  let x = Math.round(world.x - (parentRect?.x ?? 0) - ICON_SIZE / 2);
  let y = Math.round(world.y - (parentRect?.y ?? 0) - ICON_SIZE / 2);
  if (parentRect) {
    x = Math.max(0, Math.min(x, Math.round(parentRect.width) - ICON_SIZE));
    y = Math.max(0, Math.min(y, Math.round(parentRect.height) - ICON_SIZE));
  }
  return { type: "absolute", x, y };
}

// ED-037: parent freeform → ikon absolute (bisa digeser); parent auto-layout → flow (pindah via reorder).
// `set` = "lucide" (default) atau "brand" (logo Simple Icons, ED-163).
export function insertIconNode(
  runtime: CanvasRuntime,
  name: string,
  set: "lucide" | "brand" = "lucide",
): string | null {
  const selected = selectionStore.getState().selectedIds[0];
  const selectedNode = selected ? runtime.nodeStore.getNode(selected) : null;
  // Parent = frame terpilih, atau page aktif.
  const parentId =
    selectedNode && (selectedNode.type === "frame" || selectedNode.type === "page") ? selectedNode.id : runtime.pageId;
  const parent = runtime.nodeStore.getNode(parentId);
  const parentIsFlow = parent?.style.base?.layout?.mode === "flex";
  const size = {
    width: { mode: "fixed" as const, value: ICON_SIZE, unit: "px" as const },
    height: { mode: "fixed" as const, value: ICON_SIZE, unit: "px" as const },
  };
  const base = parentIsFlow ? { size } : { size, position: freeformPosition(runtime, parentId) };
  runtime.undo.stopCapturing();
  const result = runCommand(runtime.commandCtx, createNode, {
    parentId,
    type: "icon",
    props: { set, name },
    style: { base },
  });
  if (result.ok) {
    selectionStore.getState().select([result.value]);
    return result.value;
  }
  return null;
}
