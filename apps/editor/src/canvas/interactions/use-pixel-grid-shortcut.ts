import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { uiPreferencesStore } from "../../store/ui-preferences";

// ED-074: Shift+' menampilkan/menyembunyikan garis pixel grid (hanya terlihat saat zoom ≥ 800%).
export function usePixelGridShortcut(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!event.shiftKey || event.code !== "Quote") return;
      event.preventDefault();
      const { pixelGridVisible, update } = uiPreferencesStore.getState();
      update({ pixelGridVisible: !pixelGridVisible });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
