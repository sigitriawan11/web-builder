import { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";

// Lifecycle Y.Doc editor (ARCHITECTURE §5.2, §7.3): (1) IndexedDB `doc:<docId>` dimuat dulu → canvas langsung tampil
// dari cache lokal, juga saat offline; (2) token realtime dari api; (3) HocuspocusProvider — sync protocol Yjs
// menyatukan state lokal & server sehingga perubahan offline otomatis terkirim. Token JWT berumur 5 menit → diambil
// ulang setiap (re)koneksi.

export type ConnectionStatus = "loading" | "local" | "connecting" | "synced" | "offline";

export interface RealtimeAccess {
  token: string;
  url: string;
}

export interface DocumentSessionOptions {
  docId: string;
  // `POST /v1/realtime/token` lewat sdk.
  requestAccess: (docId: string) => Promise<RealtimeAccess>;
  onStatus?: (status: ConnectionStatus) => void;
  onError?: (error: unknown) => void;
}

export interface DocumentSession {
  readonly doc: Y.Doc;
  /** Selesai saat state IndexedDB sudah diterapkan (mungkin kosong untuk perangkat baru). */
  readonly whenLocalReady: Promise<void>;
  status(): ConnectionStatus;
  provider(): HocuspocusProvider | null;
  destroy(): Promise<void>;
}

export const localStoreName = (docId: string) => `doc:${docId}`;

export function openDocumentSession(options: DocumentSessionOptions): DocumentSession {
  const doc = new Y.Doc();
  const local = new IndexeddbPersistence(localStoreName(options.docId), doc);
  let status: ConnectionStatus = "loading";
  let provider: HocuspocusProvider | null = null;
  let destroyed = false;

  const setStatus = (next: ConnectionStatus) => {
    if (status === next || destroyed) return;
    status = next;
    options.onStatus?.(next);
  };

  const whenLocalReady = local.whenSynced.then(() => {
    setStatus("local");
  });

  void (async () => {
    try {
      await whenLocalReady;
      const first = await options.requestAccess(options.docId);
      if (destroyed) return;
      setStatus("connecting");
      provider = new HocuspocusProvider({
        url: first.url,
        name: options.docId,
        document: doc,
        // Token pertama dipakai sekali; koneksi ulang meminta token baru (JWT 5 menit).
        token: (() => {
          let initial: string | null = first.token;
          return async () => {
            if (initial) {
              const token = initial;
              initial = null;
              return token;
            }
            return (await options.requestAccess(options.docId)).token;
          };
        })(),
        onSynced: () => setStatus("synced"),
        onStatus: ({ status: socket }) => {
          if (socket === WebSocketStatus.Disconnected) setStatus("offline");
          else if (socket === WebSocketStatus.Connecting && status !== "synced") setStatus("connecting");
        },
      });
    } catch (error) {
      // Tanpa token (jaringan mati, api tidak terjangkau): tetap bisa bekerja dari IndexedDB.
      setStatus("offline");
      options.onError?.(error);
    }
  })();

  return {
    doc,
    whenLocalReady,
    status: () => status,
    provider: () => provider,
    async destroy() {
      destroyed = true;
      provider?.destroy();
      await local.destroy();
      doc.destroy();
    },
  };
}
