import type { Breakpoint } from "@platform/document-model";
import { createStore } from "zustand/vanilla";

// UI state (ED-006 device switcher, §21): breakpoint aktif yang sedang diedit/dipreview. Frame breakpoint & edit per
// breakpoint memakainya (Epic 2.3 / M4). Bukan dokumen.
interface BreakpointState {
  active: Breakpoint;
  setActive(breakpoint: Breakpoint): void;
}

export const BREAKPOINT_OPTIONS: readonly Breakpoint[] = ["base", "tablet", "mobile"];

/** Breakpoint fokus awal dari `?bp=` (playground/e2e: ukur satu frame breakpoint di origin, zoom 1). */
export function breakpointFromSearch(search: string): Breakpoint {
  const value = new URLSearchParams(search).get("bp");
  return BREAKPOINT_OPTIONS.find((option) => option === value) ?? "base";
}

export const breakpointStore = createStore<BreakpointState>()((set, get) => ({
  active: "base",
  setActive: (breakpoint) => {
    if (get().active !== breakpoint) set({ active: breakpoint });
  },
}));
