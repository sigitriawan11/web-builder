import { type RefObject, useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { isBlockedBrowserShortcut } from "./browser-guards";

// ED-025: cegah perilaku bawaan browser yang mengganggu kerja di canvas.
export function useBrowserGuards(viewportRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isEditableEvent(event) && isBlockedBrowserShortcut(event)) event.preventDefault();
    };
    // Drag native gambar/teks di world.
    const onDragStart = (event: DragEvent) => event.preventDefault();
    // Context menu native diganti context menu editor (§26, menyusul), kecuali di teks yang sedang diedit.
    const onContextMenu = (event: MouseEvent) => {
      if (!isEditableEvent(event)) event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    viewport.addEventListener("dragstart", onDragStart);
    viewport.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      viewport.removeEventListener("dragstart", onDragStart);
      viewport.removeEventListener("contextmenu", onContextMenu);
    };
  }, [viewportRef]);
}
