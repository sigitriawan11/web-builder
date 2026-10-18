import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { uiPreferencesStore } from "../../store/ui-preferences";

// ED-029: Shift+R menampilkan/menyembunyikan penggaris (rulers) di tepi canvas.
export function useRulerShortcut(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!event.shiftKey || event.code !== "KeyR") return;
      event.preventDefault();
      const { rulersVisible, update } = uiPreferencesStore.getState();
      update({ rulersVisible: !rulersVisible });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
