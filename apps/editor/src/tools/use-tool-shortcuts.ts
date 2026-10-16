import { useEffect } from "react";
import { matchesShortcut } from "../app/chrome/shortcut";
import { isEditableEvent } from "../commands/is-editable-target";
import { TOOLS } from "./tool-catalog";
import { type ToolId, toolStore } from "./tool-store";

// ED-006: shortcut tool dari katalog (V, F/A, Shift+S, R, O, L, T, Shift+Mod+K, Shift+I, H). Registry command &
// command palette menyusul (Epic 2.16).
function toolForEvent(event: KeyboardEvent): ToolId | null {
  for (const tool of TOOLS) if (tool.shortcuts.some((shortcut) => matchesShortcut(event, shortcut))) return tool.id;
  return null;
}

export function useToolShortcuts(): void {
  useEffect(() => {
    const { dispatch } = toolStore.getState();

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event)) return;

      if (event.code === "Space") {
        event.preventDefault(); // cegah halaman ikut scroll
        dispatch({ type: "startTemporary", tool: "hand" });
        return;
      }
      if (event.repeat) return;
      // Modifier harus persis (Ctrl+V = paste, bukan Move; Shift+Mod+K = Image).
      const tool = toolForEvent(event);
      if (!tool) return;
      if (event.ctrlKey || event.metaKey) event.preventDefault();
      dispatch({ type: "selectTool", tool });
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") dispatch({ type: "endTemporary", tool: "hand" });
    };

    // Keyup hilang jika jendela kehilangan fokus saat Space ditahan (mis. Alt+Tab).
    const onBlur = () => dispatch({ type: "endTemporary", tool: "hand" });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);
}
