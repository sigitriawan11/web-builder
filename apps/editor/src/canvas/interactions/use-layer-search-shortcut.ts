import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { layerSearchStore } from "../../store/layer-search-store";
import { textEditingStore } from "../../store/text-editing-store";

// ED-031: Mod+F membuka pencarian layer (name/teks di page aktif). Tidak aktif saat mengetik teks node (biar tak
// mengganggu); menggantikan find bawaan browser di editor.
export function useLayerSearchShortcut(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.code !== "KeyF") return;
      if (isEditableEvent(event) || textEditingStore.getState().editingId !== null) return;
      event.preventDefault();
      layerSearchStore.getState().toggle();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
