import { selectionStore } from "../store/selection-store";
import { cameraStore } from "./camera-store";
import type { CanvasRuntime } from "./canvas-runtime";
import { fitCamera, selectionCamera, unionRects, type ViewportSize } from "./fit";
import type { WorldRect } from "./geometry/geometry-store";

// ED-028 dari chrome/shortcut: hitung kamera dari geometri canvas (rect world terukur) & ukuran viewport.
function viewportSize(): ViewportSize | null {
  const viewport = document.getElementById("editor-viewport");
  return viewport ? { width: viewport.clientWidth, height: viewport.clientHeight } : null;
}

const rectsOf = (runtime: CanvasRuntime, ids: readonly string[]) =>
  ids.map((id) => runtime.geometry.store.getRect(id)).filter((rect): rect is WorldRect => rect !== null);

/** Zoom to fit: page aktif (frame breakpoint terukur); page kosong → 100% di origin. */
export function zoomToFit(runtime: CanvasRuntime): void {
  const size = viewportSize();
  if (!size) return;
  const page = runtime.nodeStore.getNode(runtime.pageId);
  const hasContent = page !== null && "children" in page && page.children.length > 0;
  cameraStore.getState().setCamera(fitCamera(hasContent ? unionRects(rectsOf(runtime, [runtime.pageId])) : null, size));
}

/** Zoom to selection; tanpa seleksi → tidak berubah. */
export function zoomToSelection(runtime: CanvasRuntime): void {
  const size = viewportSize();
  const rect = unionRects(rectsOf(runtime, selectionStore.getState().selectedIds));
  if (!size || !rect) return;
  cameraStore.getState().setCamera(selectionCamera(rect, size));
}
