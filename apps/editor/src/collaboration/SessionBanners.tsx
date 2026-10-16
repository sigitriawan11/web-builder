import { Alert, AlertDescription, Button } from "@platform/ui";
import { useEffect, useState } from "react";
import { useT } from "../app/i18n";
import type { ConnectionStatus, DocumentSession } from "./document-session";

// ED-201 / ED-227: banner sesi dokumen — offline, perubahan dipulihkan dari IndexedDB, IndexedDB tidak tersedia.
export function SessionBanners({ session, status }: { session: DocumentSession; status: ConnectionStatus }) {
  const t = useT();
  const [recoveryShown, setRecoveryShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Pesan pemulihan baru tampil setelah tersinkron: perubahan lokal saat itu sudah terkirim ke server.
  useEffect(() => {
    if (session.recoveredUnsaved && status === "synced") setRecoveryShown(true);
  }, [session, status]);

  return (
    <div className="flex flex-col gap-1 empty:hidden" data-testid="session-banners">
      {status === "offline" ? (
        <Alert variant="warning" className="rounded-none border-x-0 py-2" data-testid="offline-banner">
          <AlertDescription>{t("session.offline")}</AlertDescription>
        </Alert>
      ) : null}
      {session.localPersistence ? null : (
        <Alert variant="warning" className="rounded-none border-x-0 py-2">
          <AlertDescription>{t("session.noLocalPersistence")}</AlertDescription>
        </Alert>
      )}
      {recoveryShown && !dismissed ? (
        <Alert variant="success" className="rounded-none border-x-0 py-2" data-testid="recovery-banner">
          <AlertDescription className="flex items-center gap-2">
            {t("session.recovered")}
            <Button type="button" variant="link" size="sm" className="h-auto px-1" onClick={() => setDismissed(true)}>
              {t("session.dismiss")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
