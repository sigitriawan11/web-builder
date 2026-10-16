import { Button } from "@platform/ui";
import { CheckIcon, CloudOffIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "../app/i18n";
import type { DocumentSession } from "./document-session";
import type { SaveStatus } from "./save-tracker";

// Lama pesan "tersimpan otomatis" setelah Mod+S.
const AUTOSAVE_NOTICE_MS = 3_000;

function useSaveStatus(session: DocumentSession): SaveStatus {
  return useSyncExternalStore(session.save.subscribe, session.save.status, session.save.status);
}

// ED-200: tidak ada tombol Save — indikator status + peringatan `beforeunload` + Mod+S hanya memberi tahu.
export function SaveIndicator({ session }: { session: DocumentSession }) {
  const t = useT();
  const status = useSaveStatus(session);
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!session.save.hasUnsaved()) return;
      event.preventDefault();
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey)
        return;
      // Mencegah dialog "simpan halaman" browser; update sudah terkirim real time lewat WebSocket.
      event.preventDefault();
      setNotice(true);
      clearTimeout(timer);
      timer = setTimeout(() => setNotice(false), AUTOSAVE_NOTICE_MS);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [session]);

  const retry = () => {
    const provider = session.provider();
    provider?.disconnect();
    void provider?.connect();
  };

  return (
    <div className="flex items-center gap-2 text-xs" data-testid="save-status" data-status={status}>
      <span role="status" className="text-muted-foreground">
        {notice ? t("save.autosaved") : null}
      </span>
      {status === "saved" ? (
        <span className="flex items-center gap-1 text-muted-foreground">
          <CheckIcon className="size-3.5" aria-hidden />
          {t("save.saved")}
        </span>
      ) : status === "saving" ? (
        <span className="flex items-center gap-1 text-muted-foreground">
          <LoaderCircleIcon className="size-3.5 animate-spin" aria-hidden />
          {t("save.saving")}
        </span>
      ) : status === "offline" ? (
        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
          <CloudOffIcon className="size-3.5" aria-hidden />
          {t("save.offline")}
        </span>
      ) : (
        <span className="flex items-center gap-1 text-destructive">
          <TriangleAlertIcon className="size-3.5" aria-hidden />
          {t("save.error")}
          <Button type="button" variant="link" size="sm" className="h-auto px-1 text-xs" onClick={retry}>
            {t("save.retry")}
          </Button>
        </span>
      )}
    </div>
  );
}
