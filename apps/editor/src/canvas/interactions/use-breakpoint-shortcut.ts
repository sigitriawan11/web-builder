import type { Breakpoint } from "@platform/document-model";
import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { breakpointStore } from "../../store/breakpoint-store";

// ED-173: Alt+Shift+1/2/3 → Desktop/Tablet/Mobile (bukan Mod+1..3 yang bentrok pindah tab browser). Seleksi tetap
// (hanya mengubah breakpoint fokus, bukan dokumen).
const BY_CODE: Record<string, Breakpoint> = { Digit1: "base", Digit2: "tablet", Digit3: "mobile" };

export function useBreakpointShortcut(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event) || !event.altKey || !event.shiftKey) return;
      const breakpoint = BY_CODE[event.code];
      if (!breakpoint) return;
      event.preventDefault();
      breakpointStore.getState().setActive(breakpoint);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
