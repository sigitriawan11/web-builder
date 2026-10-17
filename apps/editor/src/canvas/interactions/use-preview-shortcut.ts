import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { previewModeStore } from "../../store/preview-mode-store";

// ED-004/ED-207: Mod+Enter masuk/keluar mode preview, Esc keluar. Selalu aktif (tidak bergantung overlay yang
// dimuat lazy), agar shortcut hidup segera setelah editor siap. Seleksi/kamera tidak disentuh.
export function usePreviewShortcut(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        if (isEditableEvent(event)) return;
        event.preventDefault();
        previewModeStore.getState().toggle();
      } else if (event.key === "Escape" && previewModeStore.getState().open) {
        event.preventDefault();
        previewModeStore.getState().setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
