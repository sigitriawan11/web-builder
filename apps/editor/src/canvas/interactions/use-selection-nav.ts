import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { type NavAction, navigateSelection } from "../../commands/selection-nav";
import { selectionStore } from "../../store/selection-store";
import { textEditingStore } from "../../store/text-editing-store";
import type { CanvasRuntime } from "../canvas-runtime";

// ED-055: navigasi hierarki seleksi via keyboard. Tidak aktif saat mengetik (text editing) atau dengan modifier
// Ctrl/Meta/Alt (shortcut lain). Enter → anak / edit teks; Shift+Enter atau `\` → parent; Tab/Shift+Tab → sibling.
export function useSelectionNav(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      const action = resolveAction(event);
      if (!action) return;

      const result = navigateSelection(action, selectionStore.getState().selectedIds, runtime.nodeStore.getNode);
      if (result.type === "none") return;
      event.preventDefault();
      if (result.type === "editText") textEditingStore.getState().startEditing(result.id);
      else selectionStore.getState().select(result.ids);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}

function resolveAction(event: KeyboardEvent): NavAction | null {
  if (event.key === "Enter") return event.shiftKey ? "parent" : "child";
  if (event.key === "\\") return "parent";
  if (event.key === "Tab") return event.shiftKey ? "prevSibling" : "nextSibling";
  return null;
}
