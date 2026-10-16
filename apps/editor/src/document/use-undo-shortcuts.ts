import { useEffect } from "react";
import { isEditableEvent } from "../commands/is-editable-target";
import type { UndoController } from "./undo-controller";
import { undoShortcut } from "./undo-shortcut";

// ED-197: shortcut undo/redo dokumen. Saat mengetik (edit teks inline), undo milik Tiptap yang berlaku.
const ALWAYS = () => true;

export function useUndoShortcuts(controller: UndoController, enabled: () => boolean = ALWAYS): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event) || !enabled()) return;
      const action = undoShortcut(event);
      if (!action) return;
      event.preventDefault();
      if (action === "undo") controller.undo();
      else controller.redo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [controller, enabled]);
}
