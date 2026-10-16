import { useEffect } from "react";
import { matchesShortcut, type Shortcut } from "../../app/chrome/shortcut";
import { isEditableEvent } from "../../commands/is-editable-target";
import type { CanvasRuntime } from "../canvas-runtime";
import { zoomTo100, zoomToFit, zoomToSelection } from "../fit-commands";

// ED-028: Shift+1 fit, Shift+2 seleksi, Shift+0 / Mod+0 100% (zoom in/out bertahap: use-zoom-interactions).
export const ZOOM_SHORTCUTS: readonly { shortcut: Shortcut; action: "fit" | "selection" | "reset" }[] = [
  { shortcut: { code: "Digit1", shift: true }, action: "fit" },
  { shortcut: { code: "Digit2", shift: true }, action: "selection" },
  { shortcut: { code: "Digit0", shift: true }, action: "reset" },
  { shortcut: { code: "Digit0", mod: true }, action: "reset" },
];

export function useZoomShortcuts(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event)) return;
      const match = ZOOM_SHORTCUTS.find(({ shortcut }) => matchesShortcut(event, shortcut));
      if (!match) return;
      event.preventDefault(); // Mod+0 = reset zoom halaman browser
      if (match.action === "fit") zoomToFit(runtime);
      else if (match.action === "selection") zoomToSelection(runtime);
      else zoomTo100();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}
