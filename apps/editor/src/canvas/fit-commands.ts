import { selectionStore } from "../store/selection-store";
import { animateCamera } from "./camera-animation";
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
  animateCamera(fitCamera(hasContent ? unionRects(rectsOf(runtime, [runtime.pageId])) : null, size));
}

/** Zoom to selection; tanpa seleksi → tidak berubah. */
export function zoomToSelection(runtime: CanvasRuntime): void {
  const size = viewportSize();
  const rect = unionRects(rectsOf(runtime, selectionStore.getState().selectedIds));
  if (!size || !rect) return;
  animateCamera(selectionCamera(rect, size));
}

/** ED-028: 100% berpusat di tengah viewport saat ini (Shift+0 / Mod+0). */
export function zoomTo100(): void {
  const size = viewportSize();
  if (!size) return;
  const { x, y, zoom } = cameraStore.getState();
  const cx = size.width / 2;
  const cy = size.height / 2;
  const center = { x: (cx - x) / zoom, y: (cy - y) / zoom };
  animateCamera({ zoom: 1, x: cx - center.x, y: cy - center.y });
}
