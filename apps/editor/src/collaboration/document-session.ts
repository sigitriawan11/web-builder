import { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { createSaveTracker, type SaveTracker } from "./save-tracker";

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
  /** ED-200: status autosave (dikonfirmasi server lewat `saved`). */
  readonly save: SaveTracker;
  /** ED-227: false bila IndexedDB tidak tersedia (pemulihan offline tidak aktif). */
  readonly localPersistence: boolean;
  /**
   * ED-227: sesi sebelumnya ditutup dengan perubahan yang belum dikonfirmasi server; perubahan itu dimuat dari
   * IndexedDB dan dikirim otomatis saat tersinkron.
   */
  readonly recoveredUnsaved: boolean;
  provider(): HocuspocusProvider | null;
  destroy(): Promise<void>;
}

export const localStoreName = (docId: string) => `doc:${docId}`;
// Penanda "ada perubahan belum terkonfirmasi" yang selamat dari crash/tutup paksa tab (ED-227).
export const unsavedMarkerKey = (docId: string) => `platform.unsaved:${docId}`;

function openLocalPersistence(docId: string, doc: Y.Doc): IndexeddbPersistence | null {
  try {
    if (typeof indexedDB === "undefined") return null;
    return new IndexeddbPersistence(localStoreName(docId), doc);
  } catch {
    return null;
  }
}

// localStorage bisa dilarang (mode privat/kebijakan) — penanda hanya pelengkap, jadi gagal = diabaikan.
function readMarker(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
function writeMarker(key: string, unsaved: boolean): void {
  try {
    if (unsaved) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  } catch {
    // diabaikan (lihat readMarker)
  }
}

export function openDocumentSession(options: DocumentSessionOptions): DocumentSession {
  const doc = new Y.Doc();
  const local = openLocalPersistence(options.docId, doc);
  const markerKey = unsavedMarkerKey(options.docId);
  const recoveredUnsaved = local !== null && readMarker(markerKey);
  let status: ConnectionStatus = "loading";
  let provider: HocuspocusProvider | null = null;
  let destroyed = false;
  const save = createSaveTracker(doc);
  // Penanda mengikuti status tersimpan; ditulis hanya saat berubah.
  let markerState = recoveredUnsaved;
  const syncMarker = () => {
    const unsaved = save.hasUnsaved();
    if (unsaved === markerState || !local) return;
    markerState = unsaved;
    writeMarker(markerKey, unsaved);
  };
  const stopMarker = save.subscribe(syncMarker);
  doc.on("update", syncMarker);

  const setStatus = (next: ConnectionStatus) => {
    if (status === next || destroyed) return;
    status = next;
    save.setOnline(next === "synced");
    options.onStatus?.(next);
  };

  // Browser tahu lebih dulu bahwa jaringan putus (socket bisa baru tertutup setelah timeout); saat online lagi
  // provider menyambung ulang dan `onSynced` mengembalikan status.
  const onOffline = () => setStatus("offline");
  const onOnline = () => {
    if (!provider || status !== "offline") return;
    // Socket masih hidup & tersinkron (putus singkat) → langsung kembali; selain itu sambung ulang.
    if (provider.synced) setStatus("synced");
    else void provider.connect();
  };
  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);

  const whenLocalReady = (local ? local.whenSynced : Promise.resolve()).then(() => {
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
        onStateless: ({ payload }) => save.handleStateless(payload),
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
    save,
    localPersistence: local !== null,
    recoveredUnsaved,
    provider: () => provider,
    async destroy() {
      destroyed = true;
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      stopMarker();
      doc.off("update", syncMarker);
      save.destroy();
      provider?.destroy();
      await local?.destroy();
      doc.destroy();
    },
  };
}
