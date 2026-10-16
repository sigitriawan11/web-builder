import type { Breakpoint } from "@platform/document-model";
import { createStore } from "zustand/vanilla";

// UI state (ED-006 device switcher, §21): breakpoint aktif yang sedang diedit/dipreview. Frame breakpoint & edit per
// breakpoint memakainya (Epic 2.3 / M4). Bukan dokumen.
interface BreakpointState {
  active: Breakpoint;
  setActive(breakpoint: Breakpoint): void;
}

export const BREAKPOINT_OPTIONS: readonly Breakpoint[] = ["base", "tablet", "mobile"];

export const breakpointStore = createStore<BreakpointState>()((set, get) => ({
  active: "base",
  setActive: (breakpoint) => {
    if (get().active !== breakpoint) set({ active: breakpoint });
  },
}));
