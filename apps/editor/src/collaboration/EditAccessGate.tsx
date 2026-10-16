import {
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@platform/ui";
import { useState, useSyncExternalStore } from "react";
import { useT } from "../app/i18n";
import type { DocumentSession, EditAccess } from "./document-session";

export function useEditAccess(session: DocumentSession): EditAccess {
  return useSyncExternalStore(session.subscribeAccess, session.access, session.access);
}

// ED-229 / ARCHITECTURE §5.5: dialog takeover saat situs dipegang user lain, banner mode lihat saja, akses dicabut
// (403), dan login ulang (401) tanpa meninggalkan editor.
export function EditAccessGate({ session }: { session: DocumentSession }) {
  const t = useT();
  const access = useEditAccess(session);
  // Dialog takeover ditutup ("Lihat saja") per pemegang; pemegang lain → dialog muncul lagi.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  if (access.kind === "locked") {
    const name = access.holder.name || "?";
    const dialogOpen = !access.released && dismissedFor !== access.holder.userId;
    return (
      <>
        <Alert variant="warning" className="rounded-none border-x-0 py-2" data-testid="lock-banner">
          <AlertDescription className="flex flex-wrap items-center gap-2">
            {access.released ? t("lock.released", { name }) : t("lock.banner", { name })}
            <Button type="button" size="sm" variant="outline" onClick={() => session.takeover()}>
              {access.released ? t("lock.startEditing") : t("lock.takeover")}
            </Button>
          </AlertDescription>
        </Alert>
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDismissedFor(access.holder.userId)}>
          <DialogContent data-testid="takeover-dialog" closeLabel={t("session.dismiss")}>
            <DialogHeader>
              <DialogTitle>{t("lock.title", { name })}</DialogTitle>
              <DialogDescription>{t("lock.description", { name })}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDismissedFor(access.holder.userId)}>
                {t("lock.viewOnly")}
              </Button>
              <Button type="button" onClick={() => session.takeover()}>
                {t("lock.takeover")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  if (access.kind === "forbidden") {
    return (
      <Alert variant="warning" className="rounded-none border-x-0 py-2" data-testid="forbidden-banner">
        <AlertDescription>{t("access.forbidden")}</AlertDescription>
      </Alert>
    );
  }
  if (access.kind === "serverOutdated") {
    return (
      <Alert variant="warning" className="rounded-none border-x-0 py-2" data-testid="server-outdated-banner">
        <AlertDescription>{t("access.serverOutdated")}</AlertDescription>
      </Alert>
    );
  }
  if (access.kind === "unauthenticated") {
    return (
      <Dialog open>
        <DialogContent data-testid="session-expired-dialog" closeLabel={t("session.dismiss")}>
          <DialogHeader>
            <DialogTitle>{t("access.sessionTitle")}</DialogTitle>
            <DialogDescription>{t("access.sessionDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button asChild variant="outline">
              <a href="/login" target="_blank" rel="noopener">
                {t("access.login")}
              </a>
            </Button>
            <Button type="button" onClick={() => session.reconnect()}>
              {t("access.reconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  return null;
}
