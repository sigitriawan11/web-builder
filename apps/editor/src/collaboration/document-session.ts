import { HocuspocusProvider, WebSocketStatus } from "@hocuspocus/provider";
import { isApiError } from "@platform/sdk";
import { type LockHolder, REALTIME_DENY_REASONS, RealtimeStatelessMessageSchema } from "@platform/shared/contracts";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { createSaveTracker, type SaveTracker } from "./save-tracker";

// Lifecycle Y.Doc editor (ARCHITECTURE §5.2, §7.3): (1) IndexedDB `doc:<docId>` dimuat dulu → canvas langsung tampil
// dari cache lokal, juga saat offline; (2) token realtime dari api; (3) HocuspocusProvider — sync protocol Yjs
// menyatukan state lokal & server sehingga perubahan offline otomatis terkirim. Token JWT berumur 5 menit → diambil
// ulang setiap (re)koneksi.

export type ConnectionStatus = "loading" | "local" | "connecting" | "synced" | "offline";

/**
 * Hak edit sesi ini (ED-229, ARCHITECTURE §5.5):
 * - `editing`: boleh mengedit;
 * - `locked`: user lain memegang lock → koneksi read-only; `released` = pemegang sudah pergi (boleh takeover);
 * - `forbidden`: api menolak (403 — akses dicabut/paket berubah) → read-only;
 * - `unauthenticated`: sesi login habis (401) → login ulang tanpa meninggalkan editor; edit tetap di IndexedDB;
 * - `serverOutdated`: realtime menolak dokumen yang lebih baru dari server-nya (`schema-unsupported`, mis. rollback
 *   deploy) → lihat saja dari data lokal sampai server diperbarui.
 */
export type EditAccess =
  | { kind: "editing" }
  | { kind: "locked"; holder: LockHolder; released: boolean }
  | { kind: "forbidden" }
  | { kind: "unauthenticated" }
  | { kind: "serverOutdated" };

const EDITING: EditAccess = { kind: "editing" };

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
  access(): EditAccess;
  subscribeAccess(listener: () => void): () => void;
  /** Ambil alih lock dari user lain (pesan klien `takeover`). */
  takeover(): void;
  /** Sambungkan ulang (mis. setelah login ulang) — token baru diminta. */
  reconnect(): void;
  destroy(): Promise<void>;
}

export const localStoreName = (docId: string) => `doc:${docId}`;
// Penanda "ada perubahan belum terkonfirmasi" yang selamat dari crash/tutup paksa tab (ED-227).
export const unsavedMarkerKey = (docId: string) => `platform.unsaved:${docId}`;

/** ED-228 "Buka versi terakhir yang tersimpan": hapus cache lokal dokumen (IndexedDB + penanda) → dimuat dari server. */
export async function discardLocalDocument(docId: string): Promise<void> {
  writeMarker(unsavedMarkerKey(docId), false);
  if (typeof indexedDB === "undefined") return;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(localStoreName(docId));
    // Diblokir koneksi lain / gagal → tetap lanjut memuat ulang; data server tetap utuh.
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

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
  let access: EditAccess = EDITING;
  const accessListeners = new Set<() => void>();
  const setAccess = (next: EditAccess) => {
    if (destroyed) return;
    access = next;
    for (const listener of accessListeners) listener();
  };
  // Kegagalan token: 401 → login ulang, 403 → read-only; selain itu jaringan (offline, provider mencoba lagi).
  const classifyAccessError = (error: unknown): boolean => {
    if (!isApiError(error)) return false;
    if (error.status === 401) setAccess({ kind: "unauthenticated" });
    else if (error.status === 403) setAccess({ kind: "forbidden" });
    else return false;
    return true;
  };
  const handleStateless = (payload: string) => {
    save.handleStateless(payload);
    let json: unknown;
    try {
      json = JSON.parse(payload);
    } catch {
      return;
    }
    const message = RealtimeStatelessMessageSchema.safeParse(json);
    if (!message.success) return;
    const data = message.data;
    if (data.type === "locked") setAccess({ kind: "locked", holder: data.holder, released: false });
    else if (data.type === "unlocked" && access.kind === "locked") setAccess({ ...access, released: true });
    else if (data.type === "lock-acquired") setAccess(EDITING);
  };
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
            try {
              const token = (await options.requestAccess(options.docId)).token;
              if (access.kind === "unauthenticated" || access.kind === "forbidden") setAccess(EDITING);
              return token;
            } catch (error) {
              classifyAccessError(error);
              throw error;
            }
          };
        })(),
        onSynced: () => setStatus("synced"),
        onStateless: ({ payload }) => handleStateless(payload),
        onAuthenticationFailed: ({ reason }) => {
          if (reason === REALTIME_DENY_REASONS.schemaUnsupported) setAccess({ kind: "serverOutdated" });
        },
        onStatus: ({ status: socket }) => {
          if (socket === WebSocketStatus.Disconnected) setStatus("offline");
          else if (socket === WebSocketStatus.Connecting && status !== "synced") setStatus("connecting");
        },
      });
    } catch (error) {
      // Tanpa token (jaringan mati, api tidak terjangkau): tetap bisa bekerja dari IndexedDB.
      setStatus("offline");
      classifyAccessError(error);
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
    access: () => access,
    subscribeAccess(listener) {
      accessListeners.add(listener);
      return () => accessListeners.delete(listener);
    },
    takeover() {
      provider?.sendStateless(JSON.stringify({ type: "takeover" }));
    },
    reconnect() {
      if (!provider) {
        // Token pertama belum pernah didapat (mis. 401 saat membuka) → muat ulang editor adalah jalur paling sederhana.
        window.location.reload();
        return;
      }
      // Token gagal diambil (401) → socket tetap terbuka tetapi belum terautentikasi: kirim token baru di socket itu.
      if (!provider.isAuthenticated) {
        void provider.sendToken();
        return;
      }
      provider.disconnect();
      void provider.connect();
    },
    async destroy() {
      destroyed = true;
      accessListeners.clear();
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
