import { runCommand, updateStyle } from "@platform/document-model";
import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { selectionStore } from "../../store/selection-store";
import type { CanvasRuntime } from "../canvas-runtime";

// ED-110: tekan angka 1–9 = opacity 10–90%, 0 = 100% pada node terseleksi (tanpa modifier, bukan saat mengetik).
export function useOpacityShortcut(runtime: CanvasRuntime): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event) || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (!/^[0-9]$/.test(event.key)) return;
      const ids = selectionStore.getState().selectedIds;
      if (ids.length === 0) return;
      event.preventDefault();
      const opacity = event.key === "0" ? 1 : Number(event.key) / 10;
      runtime.undo.stopCapturing();
      runtime.doc.transact(() => {
        for (const id of ids) {
          if (runtime.nodeStore.getNode(id)?.locked) continue;
          runCommand({ doc: runtime.doc, origin: runtime.origin }, updateStyle, { ids: [id], patch: { opacity } });
        }
      }, runtime.origin);
      runtime.undo.stopCapturing();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}
