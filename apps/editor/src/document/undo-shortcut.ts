export interface UndoKeyInput {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

// ED-197: Mod+Z = undo, Mod+Shift+Z & Mod+Y (Windows) = redo. `code` (bukan `key`) agar tidak
// bergantung layout keyboard.
export function undoShortcut(input: UndoKeyInput): "undo" | "redo" | null {
  if (!(input.ctrlKey || input.metaKey) || input.altKey) return null;
  if (input.code === "KeyZ") return input.shiftKey ? "redo" : "undo";
  if (input.code === "KeyY" && !input.shiftKey) return "redo";
  return null;
}
