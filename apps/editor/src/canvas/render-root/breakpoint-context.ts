import type { Breakpoint } from "@platform/document-model";
import { createContext } from "react";

// Breakpoint & lebar artboard frame yang sedang dirender (ED-034). Default: satu frame Desktop.
export interface FrameContextValue {
  breakpoint: Breakpoint;
  width: number;
}

// DM-035: previewWidth default Desktop (settings.breakpoints belum ada di schema prototipe).
export const DESKTOP_FRAME: FrameContextValue = { breakpoint: "base", width: 1440 };

export const FrameContext = createContext<FrameContextValue>(DESKTOP_FRAME);
