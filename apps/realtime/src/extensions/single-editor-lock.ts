import type {
  Connection,
  ConnectionConfiguration,
  connectedPayload,
  Extension,
  Hocuspocus,
  onConfigurePayload,
  onDisconnectPayload,
  onStatelessPayload,
} from "@hocuspocus/server";
import { type Db, systemScope } from "@platform/db";
import { type LockHolder, parseRealtimeClientMessage, type RealtimeStatelessMessage } from "@platform/shared/contracts";
import type { Logger } from "@platform/shared/node";
import type { RealtimeContext } from "../auth";
import type { EditorLock } from "../lock/editor-lock";
import { findUserName } from "../persistence/users.repository";

// ARCHITECTURE §5.5 + keputusan owner T1.12.6: satu USER pengedit per dokumen (sebelum multiplayer M9). Koneksi
// pengedit dari user lain → read-only + pesan `locked`; ia boleh `takeover` (pemegang lama jadi read-only + `locked`).
// Tab/perangkat lain user yang sama tetap boleh mengedit (ED-201, CRDT). Viewer tidak terlibat lock.
// Lock diambil di `onAuthenticate` server (lewat `authorize`) karena read-only harus ditetapkan sebelum koneksi dibuat.

export interface SingleEditorLockOptions {
  lock: EditorLock;
  db: Db;
  logger: Logger;
  // Perpanjang lock (TTL 30 s) tiap 10 s selama pemegang masih tersambung ke instance ini.
  heartbeatMs?: number;
  now?: () => number;
}

interface HeldLock {
  holder: LockHolder;
  // Sejak kapan dipegang — beri jeda antara authorize dan koneksi benar-benar terbentuk.
  since: number;
}

const isEditor = (connection: Connection<RealtimeContext>) => connection.context.role !== "viewer";

export class SingleEditorLockExtension implements Extension {
  // Dokumen yang lock-nya dipegang user yang tersambung ke instance INI.
  private readonly held = new Map<string, HeldLock>();
  private instance: Hocuspocus | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly heartbeatMs: number;
  private readonly now: () => number;

  constructor(private readonly options: SingleEditorLockOptions) {
    this.heartbeatMs = options.heartbeatMs ?? 10_000;
    this.now = options.now ?? Date.now;
  }

  async onConfigure({ instance }: onConfigurePayload): Promise<void> {
    this.instance = instance;
  }

  /** Dipanggil `onAuthenticate` server setelah token valid; hasilnya ditambahkan ke context koneksi. */
  async authorize(
    context: RealtimeContext,
    connectionConfig: ConnectionConfiguration,
  ): Promise<Pick<RealtimeContext, "userName" | "lockedBy">> {
    if (context.role === "viewer") return {};
    const userName =
      (await findUserName(this.options.db, systemScope("realtime: nama pemegang lock"), context.userId)) ?? "";
    const holder = { userId: context.userId, name: userName };
    const result = await this.options.lock.acquire(context.docId, holder);
    if (result.acquired) {
      this.hold(context.docId, holder);
      return { userName };
    }
    connectionConfig.readOnly = true;
    this.options.logger.info({ docId: context.docId, userId: context.userId }, "dokumen dikunci user lain");
    return { userName, lockedBy: result.holder };
  }

  async connected({ connection, context }: connectedPayload<RealtimeContext>): Promise<void> {
    if (context.lockedBy) send(connection, { type: "locked", holder: context.lockedBy });
  }

  async onStateless({ connection, documentName, payload }: onStatelessPayload): Promise<void> {
    const message = parseRealtimeClientMessage(payload);
    if (message?.type !== "takeover") return;
    const requester = connection as Connection<RealtimeContext>;
    if (!isEditor(requester)) return;
    const holder = { userId: requester.context.userId, name: requester.context.userName ?? "" };
    await this.options.lock.takeover(documentName, holder);
    this.hold(documentName, holder);
    this.options.logger.info({ docId: documentName, userId: holder.userId }, "lock diambil alih");
    this.applyHolder(documentName, holder);
  }

  async onDisconnect({
    documentName,
    context,
    document,
    socketId,
  }: onDisconnectPayload<RealtimeContext>): Promise<void> {
    if (context.role === "viewer") return;
    const held = this.held.get(documentName);
    if (held?.holder.userId !== context.userId) return;
    const remaining = (document.getConnections() as Connection<RealtimeContext>[]).filter(
      (connection) => connection.socketId !== socketId,
    );
    if (remaining.some((connection) => isEditor(connection) && connection.context.userId === context.userId)) return;
    await this.release(documentName, held.holder.userId);
    // Pengedit lain yang menunggu boleh mulai (`takeover` kini tanpa merebut dari siapa pun).
    for (const connection of remaining) if (isEditor(connection)) send(connection, { type: "unlocked" });
  }

  async onDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    await Promise.all([...this.held].map(([docId, held]) => this.release(docId, held.holder.userId)));
  }

  /** Satu putaran heartbeat (dipanggil timer; test memanggil langsung). */
  async heartbeat(): Promise<void> {
    for (const [docId, held] of [...this.held]) {
      const holderConnections = this.connections(docId).filter(
        (connection) => isEditor(connection) && connection.context.userId === held.holder.userId,
      );
      if (holderConnections.length === 0) {
        // Koneksi tidak pernah terbentuk (mis. dokumen gagal dimuat) → jangan pegang lock selamanya.
        if (this.now() - held.since >= this.heartbeatMs) await this.release(docId, held.holder.userId);
        continue;
      }
      const result = await this.options.lock.heartbeat(docId, held.holder);
      // Diambil alih lewat instance lain → pemegang di sini jadi read-only.
      if (!result.acquired) {
        this.held.delete(docId);
        this.applyHolder(docId, result.holder);
      }
    }
  }

  // Terapkan pemegang baru ke semua koneksi pengedit dokumen di instance ini.
  private applyHolder(docId: string, holder: LockHolder): void {
    for (const connection of this.connections(docId)) {
      if (!isEditor(connection)) continue;
      if (connection.context.userId === holder.userId) {
        if (connection.readOnly || connection.context.lockedBy) {
          connection.readOnly = false;
          connection.context.lockedBy = undefined;
          send(connection, { type: "lock-acquired" });
        }
      } else if (!connection.readOnly || connection.context.lockedBy?.userId !== holder.userId) {
        connection.readOnly = true;
        connection.context.lockedBy = holder;
        send(connection, { type: "locked", holder });
      }
    }
  }

  private hold(docId: string, holder: LockHolder): void {
    this.held.set(docId, { holder, since: this.now() });
    this.timer ??= setInterval(() => {
      this.heartbeat().catch((error: unknown) => this.options.logger.error({ err: error }, "heartbeat lock gagal"));
    }, this.heartbeatMs);
  }

  private async release(docId: string, userId: string): Promise<void> {
    this.held.delete(docId);
    await this.options.lock.release(docId, userId);
    if (this.held.size === 0 && this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private connections(docId: string): Connection<RealtimeContext>[] {
    return (this.instance?.documents.get(docId)?.getConnections() ?? []) as Connection<RealtimeContext>[];
  }
}

function send(connection: Connection, message: RealtimeStatelessMessage): void {
  connection.sendStateless(JSON.stringify(message));
}
