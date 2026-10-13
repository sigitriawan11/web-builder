import { useCallback, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { cameraStore } from "./camera-store";
import { spikeGeometry } from "./geometry/spike-geometry";

// Outline 1px dari geometry store: debug `?outline=<nodeId>` (T0.5.1) & seleksi dasar (T0.5.4).
// Handle, label ukuran & hover menyusul di T0.5.6.
export function GeometryOutline({
  nodeId,
  className = "overlay-geometry-outline",
}: {
  nodeId: string;
  className?: string;
}) {
  const subscribe = useCallback((listener: () => void) => spikeGeometry.subscribe(nodeId, listener), [nodeId]);
  // peekRect: baca cache tanpa memaksa layout (AC ED-019).
  const rect = useSyncExternalStore(subscribe, () => spikeGeometry.peekRect(nodeId));
  const camera = useStore(cameraStore);
  if (!rect) return null;

  return (
    <div
      className={`overlay-outline ${className}`}
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
