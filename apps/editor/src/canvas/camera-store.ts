import { createStore } from "zustand/vanilla";
import type { CameraState } from "./geometry/coordinates";

export type Camera = CameraState;

// ED-013 P0: 5%–1600%. Rentang final diputuskan di spike (❓ OPEN 02#1, T0.8.3).
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 16;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

interface CameraStoreState extends Camera {
  setCamera(next: Partial<Camera>): void;
}

export function createCameraStore(initial: Camera = { x: 0, y: 0, zoom: 1 }) {
  return createStore<CameraStoreState>()((set) => ({
    ...initial,
    zoom: clampZoom(initial.zoom),
    setCamera: (next) =>
      set((state) => ({
        x: next.x ?? state.x,
        y: next.y ?? state.y,
        zoom: clampZoom(next.zoom ?? state.zoom),
      })),
  }));
}

// Spike M0: kamera awal bisa diatur lewat URL (`?zoom=4&x=-200&y=0`) untuk cek manual & benchmark.
export function cameraFromSearch(search: string): Camera {
  const params = new URLSearchParams(search);
  const read = (key: string, fallback: number) => {
    const value = Number(params.get(key) ?? Number.NaN);
    return Number.isFinite(value) ? value : fallback;
  };
  return { x: read("x", 0), y: read("y", 0), zoom: read("zoom", 1) };
}

export function cameraTransform({ x, y, zoom }: Camera): string {
  return `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
}

export const cameraStore = createCameraStore(cameraFromSearch(window.location.search));
