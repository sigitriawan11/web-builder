import { type CameraState, screenPoint, screenToWorld } from "../geometry/coordinates";
import { clampZoom } from "../zoom-limits";
import { LINE_HEIGHT_PX } from "./pan";

// Logika murni zoom (ED-027); event DOM ditangani di use-zoom-interactions.ts.

// ED-027: `zoom *= exp(-deltaY * 0.01)`. Kalibrasi akhir dicek manual (rasa "seperti Figma").
export const WHEEL_ZOOM_SENSITIVITY = 0.01;

// ED-027: langkah `+`/`-`, dalam skala zoom (1 = 100%).
export const ZOOM_STEPS = [0.05, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 4, 8, 16] as const;

// Toleransi agar zoom yang "hampir" sama dengan preset dianggap sudah di preset itu.
const STEP_EPSILON = 1e-6;

const VIEWPORT_ORIGIN = { left: 0, top: 0 };

/**
 * Zoom dengan titik `anchor` (screen, relatif ke pojok kiri atas viewport) tetap di tempat:
 * titik world di bawah anchor sebelum zoom tetap di bawah anchor sesudahnya.
 */
export function zoomAtPoint(camera: CameraState, anchor: { x: number; y: number }, nextZoom: number): CameraState {
  const zoom = clampZoom(nextZoom);
  const world = screenToWorld(screenPoint(anchor.x, anchor.y), camera, VIEWPORT_ORIGIN);
  return { x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom, zoom };
}

// Faktor pengali zoom dari delta wheel; deltaY negatif (scroll/pinch keluar) = zoom in.
export function wheelZoomFactor(deltaY: number, deltaMode: number): number {
  const deltaPx = deltaMode === 1 ? deltaY * LINE_HEIGHT_PX : deltaY;
  return Math.exp(-deltaPx * WHEEL_ZOOM_SENSITIVITY);
}

// Preset berikutnya (in) atau sebelumnya (out); di ujung rentang tetap di ujung.
export function nextZoomStep(zoom: number, direction: "in" | "out"): number {
  if (direction === "in") {
    return ZOOM_STEPS.find((step) => step > zoom * (1 + STEP_EPSILON)) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? zoom;
  }
  return [...ZOOM_STEPS].reverse().find((step) => step < zoom * (1 - STEP_EPSILON)) ?? ZOOM_STEPS[0] ?? zoom;
}

export interface ZoomKeyInput {
  key: string;
  altKey: boolean;
}

// ED-027: `+`/`=` (dengan atau tanpa Mod) zoom in, `-` zoom out.
export function zoomKeyDirection(input: ZoomKeyInput): "in" | "out" | null {
  if (input.altKey) return null;
  if (input.key === "+" || input.key === "=") return "in";
  if (input.key === "-" || input.key === "_") return "out";
  return null;
}
