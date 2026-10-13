import type { Breakpoint } from "@platform/document-model";

// Spike M0 (ED-034, ❓ OPEN 02#11): cara merender breakpoint frame di canvas.
// - "class": semua frame di DOM yang sama; tiap frame diberi class `bp-*` & style per breakpoint (opsi a).
// - "iframe": satu iframe per frame (opsi b). Keputusan final di T0.8.2.
export const FRAME_MODES = ["class", "iframe"] as const;
export type FrameMode = (typeof FRAME_MODES)[number];

export interface FrameSpec {
  breakpoint: Breakpoint;
  label: string;
  width: number;
  // Posisi kiri frame di world.
  x: number;
}

// DM-035: previewWidth default; ED-034: jarak antar frame 100px world.
const PREVIEW_WIDTHS: { breakpoint: Breakpoint; label: string; width: number }[] = [
  { breakpoint: "base", label: "Desktop", width: 1440 },
  { breakpoint: "tablet", label: "Tablet", width: 768 },
  { breakpoint: "mobile", label: "Mobile", width: 390 },
];
export const FRAME_GAP = 100;

export function layoutFrames(showAll: boolean): FrameSpec[] {
  const frames = showAll ? PREVIEW_WIDTHS : PREVIEW_WIDTHS.slice(0, 1);
  let x = 0;
  return frames.map((frame) => {
    const spec = { ...frame, x };
    x += frame.width + FRAME_GAP;
    return spec;
  });
}

export function frameOptionsFromSearch(search: string): { showAll: boolean; mode: FrameMode } {
  const params = new URLSearchParams(search);
  const mode = FRAME_MODES.find((value) => value === params.get("bpMode")) ?? "class";
  return { showAll: params.get("frames") === "all", mode };
}
