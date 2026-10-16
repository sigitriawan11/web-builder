import type { Breakpoint } from "@platform/document-model";

// Spike M0 (ED-034, ❓ OPEN 02#11): cara merender breakpoint frame di canvas.
// - "class": semua frame di DOM yang sama; tiap frame diberi class `bp-*` & style per breakpoint (opsi a).
// - "iframe": satu iframe per frame (opsi b). Keputusan final di T0.8.2.
export const FRAME_MODES = ["class", "iframe"] as const;
export type FrameMode = (typeof FRAME_MODES)[number];

export interface FrameSpec {
  breakpoint: Breakpoint;
  // Nama untuk pengguna dari i18n `editor.breakpoints.<breakpoint>` (ED-221).
  width: number;
  // Posisi kiri frame di world.
  x: number;
  // ED-034: tinggi minimal = tinggi viewport preset (garis "fold" ditampilkan di sini).
  minHeight: number;
}

// DM-035: previewWidth default (dipakai bila dokumen tidak memberi `settings.breakpoints`); ED-034: jarak 100px.
export const DEFAULT_PREVIEW_WIDTHS: Readonly<Record<Breakpoint, number>> = { base: 1440, tablet: 768, mobile: 390 };
// ED-034: tinggi viewport preset Desktop 900, Tablet 1024, Mobile 812.
export const VIEWPORT_HEIGHTS: Readonly<Record<Breakpoint, number>> = { base: 900, tablet: 1024, mobile: 812 };
const ORDER: readonly Breakpoint[] = ["base", "tablet", "mobile"];
export const FRAME_GAP = 100;

export interface FrameLayoutOptions {
  // Lebar preview per breakpoint (`settings.breakpoints[].previewWidth`).
  widths?: Readonly<Record<Breakpoint, number>> | undefined;
  // Mode fokus (tidak semua device): frame breakpoint ini saja, di origin world.
  focus?: Breakpoint | undefined;
}

/** ED-034: frame breakpoint berdampingan (semua device) atau satu frame (fokus). */
export function layoutFrames(showAll: boolean, options: FrameLayoutOptions = {}): FrameSpec[] {
  const widths = options.widths ?? DEFAULT_PREVIEW_WIDTHS;
  const breakpoints = showAll ? ORDER : [options.focus ?? "base"];
  let x = 0;
  return breakpoints.map((breakpoint) => {
    const spec = { breakpoint, width: widths[breakpoint], x, minHeight: VIEWPORT_HEIGHTS[breakpoint] };
    x += spec.width + FRAME_GAP;
    return spec;
  });
}

/** Frame di bawah titik world x (null = di luar/di antara frame). */
export function frameAtWorldX(frames: readonly FrameSpec[], worldX: number): FrameSpec | null {
  return frames.find((frame) => worldX >= frame.x && worldX <= frame.x + frame.width) ?? null;
}

export function frameOptionsFromSearch(search: string): { showAll: boolean; mode: FrameMode } {
  const params = new URLSearchParams(search);
  const mode = FRAME_MODES.find((value) => value === params.get("bpMode")) ?? "class";
  return { showAll: params.get("frames") === "all", mode };
}
