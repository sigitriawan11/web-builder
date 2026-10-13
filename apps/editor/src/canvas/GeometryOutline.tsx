import { useCallback, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { cameraStore } from "./camera-store";
import { spikeGeometry } from "./geometry/spike-geometry";

// SPIKE T0.5.1 (`?outline=<nodeId>`): outline dari geometry store untuk memverifikasi rect world
// menempel pada elemen DOM di semua zoom. Selection overlay sungguhan dibuat di T0.5.6.
export function GeometryOutline({ nodeId }: { nodeId: string }) {
  const subscribe = useCallback((listener: () => void) => spikeGeometry.subscribe(nodeId, listener), [nodeId]);
  // peekRect: baca cache tanpa memaksa layout (AC ED-019).
  const rect = useSyncExternalStore(subscribe, () => spikeGeometry.peekRect(nodeId));
  const camera = useStore(cameraStore);
  if (!rect) return null;

  return (
    <div
      className="overlay-outline overlay-geometry-outline"
      style={{
        transform: `translate(${rect.x * camera.zoom + camera.x}px, ${rect.y * camera.zoom + camera.y}px)`,
        width: rect.width * camera.zoom,
        height: rect.height * camera.zoom,
      }}
    />
  );
}

export function outlineNodeFromSearch(search: string): string | null {
  return new URLSearchParams(search).get("outline");
}
