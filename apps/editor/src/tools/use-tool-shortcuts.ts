import { useEffect } from "react";
import { isEditableEvent } from "../commands/is-editable-target";
import { type ToolId, toolStore } from "./tool-store";

// Shortcut tool M0. Sistem command & keybinding (tinykeys, command palette) menyusul di M2.
const TOOL_KEYS: Record<string, ToolId> = { KeyV: "select", KeyH: "hand" };

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
      // Modifier dibiarkan untuk shortcut lain (mis. Ctrl+V = paste).
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const tool = TOOL_KEYS[event.code];
      if (tool) dispatch({ type: "selectTool", tool });
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
