import { useStore } from "zustand";
import { uiPreferencesStore } from "../../store/ui-preferences";
import { cameraStore } from "../camera-store";

// ED-074: garis pixel grid (1px abu-abu) saat zoom ≥ 800%; 1px world = `zoom` px screen. Toggle Shift+'.
const MIN_ZOOM = 8;

export function PixelGridOverlay() {
  const camera = useStore(cameraStore);
  const visible = useStore(uiPreferencesStore, (state) => state.pixelGridVisible);
  if (!visible || camera.zoom < MIN_ZOOM) return null;

  const size = camera.zoom;
  const offsetX = ((camera.x % size) + size) % size;
  const offsetY = ((camera.y % size) + size) % size;
  return (
    <div
      className="overlay-pixel-grid"
      data-testid="pixel-grid"
      style={{ backgroundSize: `${size}px ${size}px`, backgroundPosition: `${offsetX}px ${offsetY}px` }}
    />
  );
}
