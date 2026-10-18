import { useEffect } from "react";
import { useStore } from "zustand";
import { useLocale, useT } from "../../app/i18n";
import { type Toast, toastStore } from "../../store/toast-store";

const AUTO_DISMISS_MS = 4000;

function ToastItem({ toast }: { toast: Toast }) {
  const t = useT();
  const locale = useLocale();
  useEffect(() => {
    const timer = setTimeout(() => toastStore.getState().dismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast.id]);
  const text = toast.messageKey ? t(toast.messageKey) : toast.text[locale];
  return (
    <div className="overlay-toast" role={toast.kind === "error" ? "alert" : "status"} data-kind={toast.kind}>
      {text}
    </div>
  );
}

// ED-036/ED-070/ED-228: toast ringan di atas canvas (screen space). Tidak menerima pointer kecuali hover.
export function Toasts() {
  const toasts = useStore(toastStore, (state) => state.toasts);
  if (toasts.length === 0) return null;
  return (
    <div className="overlay-toasts" data-testid="toasts">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
