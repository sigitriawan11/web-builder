import { easeOutCubic, interpolateCamera } from "./camera-interpolation";
import { cameraStore } from "./camera-store";
import type { CameraState } from "./geometry/coordinates";

// ED-028: transisi kamera 200 ms ease-out; mati bila `prefers-reduced-motion` (Preferences menyusul, Epic 2.16).
export const CAMERA_ANIMATION_MS = 200;

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

let running = 0;

/** Animasikan kamera ke target (membatalkan animasi sebelumnya); reduced motion → langsung. */
export function animateCamera(target: CameraState, duration = CAMERA_ANIMATION_MS): void {
  cancelAnimationFrame(running);
  running = 0;
  const viewport = document.getElementById("editor-viewport");
  if (duration <= 0 || prefersReducedMotion() || !viewport) {
    cameraStore.getState().setCamera(target);
    return;
  }
  const size = { width: viewport.clientWidth, height: viewport.clientHeight };
  const { x, y, zoom } = cameraStore.getState();
  const from = { x, y, zoom };
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    cameraStore.getState().setCamera(interpolateCamera(from, target, easeOutCubic(t), size));
    running = t < 1 ? requestAnimationFrame(tick) : 0;
  };
  running = requestAnimationFrame(tick);
}
