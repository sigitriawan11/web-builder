import { runCommand, setLocked, setVisible } from "@platform/document-model";
import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { selectionStore } from "../../store/selection-store";
import type { CanvasRuntime } from "../canvas-runtime";

// ED-059: `Mod+Shift+L` kunci/buka kunci & `Mod+Shift+H` sembunyikan/tampilkan node terseleksi. Toggle konsisten:
// jika sebagian belum terkunci → kunci semua (sebaliknya buka); jika sebagian masih tampil → sembunyikan semua.
export function useLockHide(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event)) return;
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== "l" && key !== "h") return;
      const ids = selectionStore.getState().selectedIds;
      if (ids.length === 0) return;
      event.preventDefault();

      const ctx = { doc: runtime.doc, origin: runtime.origin };
      runtime.undo.stopCapturing();
      if (key === "l") {
        const lock = !ids.every((id) => runtime.nodeStore.getNode(id)?.locked === true);
        runCommand(ctx, setLocked, { ids: [...ids], locked: lock });
      } else {
        const hide = ids.every((id) => runtime.nodeStore.getNode(id)?.visible !== false);
        runCommand(ctx, setVisible, { ids: [...ids], visible: !hide });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}
