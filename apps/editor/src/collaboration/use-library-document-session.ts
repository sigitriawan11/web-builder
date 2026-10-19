import { usePlatformApi } from "@platform/sdk/react";
import { useEffect, useState } from "react";
import { type ConnectionStatus, type DocumentSession, openDocumentSession } from "./document-session";

// Sesi dokumen draft component (Mode Admin, Approach A). Seperti `useDocumentSession` tetapi token realtime diminta
// lewat endpoint admin (`library.realtimeToken(componentId)`, D3) — bukan token situs tenant. Satu sesi per `docId`.
export function useLibraryDocumentSession(
  docId: string,
  componentId: string,
): { session: DocumentSession | null; status: ConnectionStatus } {
  const api = usePlatformApi();
  const [session, setSession] = useState<DocumentSession | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("loading");

  useEffect(() => {
    const opened = openDocumentSession({
      docId,
      requestAccess: () => api.library.realtimeToken(componentId),
      onStatus: setStatus,
      onError: (error) => console.warn("editor admin: koneksi realtime gagal, bekerja dari data lokal", error),
    });
    setSession(opened);
    return () => {
      setSession(null);
      void opened.destroy();
    };
  }, [api, docId, componentId]);

  return { session, status };
}
