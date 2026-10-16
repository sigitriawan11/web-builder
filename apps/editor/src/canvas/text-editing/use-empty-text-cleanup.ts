import { deleteNodes, plainText, runCommand } from "@platform/document-model";
import { useEffect } from "react";
import { textEditingStore } from "../../store/text-editing-store";
import type { CanvasRuntime } from "../canvas-runtime";

// ED-044: saat selesai mengedit teks (editingId → null), node teks yang tetap kosong dihapus — tanpa langkah undo
// tambahan (digabung dengan pembuatan via stopCapturing di sisi pembuat).
export function useEmptyTextCleanup(runtime: CanvasRuntime): void {
  useEffect(() => {
    let previous = textEditingStore.getState().editingId;
    return textEditingStore.subscribe((state) => {
      const ended = previous;
      previous = state.editingId;
      if (ended === null || state.editingId === ended) return;
      const node = runtime.nodeStore.getNode(ended);
      if (node?.type === "text" && plainText(node.props.content).trim() === "") {
        runCommand({ doc: runtime.doc, origin: runtime.origin }, deleteNodes, { ids: [ended] });
      }
    });
  }, [runtime]);
}
