import type { MessageKey } from "@platform/i18n";
import { useEffect } from "react";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import { toastStore } from "../../store/toast-store";

const AUTO_DISMISS_MS = 4000;

function ToastItem({ id, messageKey }: { id: number; messageKey: MessageKey<"editor"> }) {
  const t = useT();
  useEffect(() => {
    const timer = setTimeout(() => toastStore.getState().dismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id]);
  return (
    <div className="overlay-toast" role="status">
      {t(messageKey)}
    </div>
  );
}

// ED-036/ED-070: toast ringan di atas canvas (screen space). Tidak menerima pointer kecuali hover (tidak ada aksi).
export function Toasts() {
  const toasts = useStore(toastStore, (state) => state.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="overlay-toasts" data-testid="toasts">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} messageKey={toast.messageKey} />
      ))}
    </div>
  );
}
