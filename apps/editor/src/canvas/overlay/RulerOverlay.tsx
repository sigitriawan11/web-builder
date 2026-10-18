import { useStore } from "zustand";
import { selectionStore } from "../../store/selection-store";
import { uiPreferencesStore } from "../../store/ui-preferences";
import { cameraStore } from "../camera-store";
import { useCanvasRuntime } from "../canvas-runtime";
import { niceStep, rulerTicks } from "./ruler-math";

// ED-029: penggaris horizontal & vertikal di tepi canvas (toggle Shift+R). Satuan px; tick menyesuaikan zoom
// (interval 1/2/5 ×10ⁿ agar label tak bertumpuk). Origin = pojok kiri-atas frame/page induk seleksi (atau page aktif).
// Area seleksi di-highlight (pita) di kedua penggaris. Guide (drag dari ruler) = P2, belum.

export const RULER_SIZE = 20; // ketebalan bar (px screen)

/** Origin ruler = rect frame/page induk seleksi (world), fallback page aktif, fallback 0. */
function rulerOrigin(
  runtime: ReturnType<typeof useCanvasRuntime>,
  selectedId: string | undefined,
): {
  x: number;
  y: number;
} {
  let id = selectedId ?? runtime.pageId;
  // Naik ke frame/page terdekat.
  for (let guard = 0; guard < 100; guard++) {
    const node = runtime.nodeStore.getNode(id);
    if (!node) break;
    if (node.type === "frame" || node.type === "page") break;
    if (!node.parentId) break;
    id = node.parentId;
  }
  const rect = runtime.geometry.store.getRect(id) ?? runtime.geometry.store.getRect(runtime.pageId);
  return { x: rect?.x ?? 0, y: rect?.y ?? 0 };
}

export function RulerOverlay() {
  const runtime = useCanvasRuntime();
  const camera = useStore(cameraStore);
  const visible = useStore(uiPreferencesStore, (state) => state.rulersVisible);
  const selectedIds = useStore(selectionStore, (state) => state.selectedIds);
  if (!visible) return null;

  const viewport = document.getElementById("editor-viewport")?.getBoundingClientRect();
  const width = viewport?.width ?? 0;
  const height = viewport?.height ?? 0;
  if (width === 0 || height === 0) return null;

  const origin = rulerOrigin(runtime, selectedIds[0]);
  const step = niceStep(camera.zoom);
  const hTicks = rulerTicks(width, camera.x, camera.zoom, step, origin.x);
  const vTicks = rulerTicks(height, camera.y, camera.zoom, step, origin.y);

  // Highlight rentang seleksi (world → screen).
  const sel = selectedIds[0] ? runtime.geometry.store.getRect(selectedIds[0]) : null;
  const hBand = sel ? { start: camera.x + sel.x * camera.zoom, size: sel.width * camera.zoom } : null;
  const vBand = sel ? { start: camera.y + sel.y * camera.zoom, size: sel.height * camera.zoom } : null;

  return (
    <div className="overlay-rulers" data-testid="rulers" aria-hidden>
      {/* Pojok kiri-atas kosong. */}
      <div className="overlay-ruler-corner" style={{ width: RULER_SIZE, height: RULER_SIZE }} />
      {/* Penggaris horizontal (atas). */}
      <div className="overlay-ruler overlay-ruler-h" style={{ left: RULER_SIZE, height: RULER_SIZE }}>
        {hBand && hBand.size > 0 ? (
          <div className="overlay-ruler-band" style={{ left: hBand.start, width: hBand.size }} />
        ) : null}
        {hTicks.map((tick) => (
          <div key={tick.label} className="overlay-ruler-tick overlay-ruler-tick-h" style={{ left: tick.pos }}>
            <span className="overlay-ruler-label">{tick.label}</span>
          </div>
        ))}
      </div>
      {/* Penggaris vertikal (kiri). */}
      <div className="overlay-ruler overlay-ruler-v" style={{ top: RULER_SIZE, width: RULER_SIZE }}>
        {vBand && vBand.size > 0 ? (
          <div className="overlay-ruler-band overlay-ruler-band-v" style={{ top: vBand.start, height: vBand.size }} />
        ) : null}
        {vTicks.map((tick) => (
          <div key={tick.label} className="overlay-ruler-tick overlay-ruler-tick-v" style={{ top: tick.pos }}>
            <span className="overlay-ruler-label overlay-ruler-label-v">{tick.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
