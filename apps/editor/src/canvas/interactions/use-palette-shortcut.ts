import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { paletteStore } from "../../store/palette-store";
import { selectionStore } from "../../store/selection-store";
import { textEditingStore } from "../../store/text-editing-store";

// ED-204: Mod+/ selalu membuka command palette; Mod+K membuka HANYA bila tak ada seleksi & tidak sedang edit teks
// (bila ada seleksi/edit teks, Mod+K = Add link — ditangani use-node-link-shortcut / editor teks).
export function usePaletteShortcut(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const editing = isEditableEvent(event) || textEditingStore.getState().editingId !== null;
      if (event.code === "Slash") {
        // Mod+/ aktif juga di input (membuka palette dari mana pun kecuali saat mengetik teks node).
        if (textEditingStore.getState().editingId !== null) return;
        event.preventDefault();
        paletteStore.getState().toggle();
      } else if (event.code === "KeyK") {
        if (editing || selectionStore.getState().selectedIds.length > 0) return;
        event.preventDefault();
        paletteStore.getState().toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
