import { usePlatformApi } from "@platform/sdk/react";
import { useEffect, useState } from "react";
import { type ConnectionStatus, type DocumentSession, openDocumentSession } from "./document-session";

/** Buka sesi dokumen selama komponen terpasang (satu per `docId`). */
export function useDocumentSession(docId: string): { session: DocumentSession | null; status: ConnectionStatus } {
  const api = usePlatformApi();
  const [session, setSession] = useState<DocumentSession | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("loading");

  useEffect(() => {
    const opened = openDocumentSession({
      docId,
      requestAccess: (id) => api.realtime.token(id),
      onStatus: setStatus,
      onError: (error) => console.warn("editor: koneksi realtime gagal, bekerja dari data lokal", error),
    });
    setSession(opened);
    return () => {
      setSession(null);
      void opened.destroy();
    };
  }, [api, docId]);

  return { session, status };
}
