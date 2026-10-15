import type { afterLoadDocumentPayload, Document, Extension, onLoadDocumentPayload } from "@hocuspocus/server";
import { DOCUMENT_UPDATE_CHANNEL_PREFIX, documentUpdateChannel } from "@platform/shared/contracts";
import type { Logger } from "@platform/shared/node";
import type { Redis } from "ioredis";
import * as Y from "yjs";

// ARCHITECTURE §5.5: subscribe `doc-ext:<docId>` selama dokumen dimuat di instance ini → `Y.applyUpdate(doc, u,
// "server")` agar klien terhubung menerima perubahan dari penulis sisi server. Update sudah tersimpan oleh
// penulisnya, jadi persistence melewati origin ini (lihat `isServerBusOrigin`).
//
// Subscribe dilakukan SEBELUM persistence membaca DB (priority lebih tinggi); pesan yang tiba selama load diantre
// lalu diterapkan setelah load — update Yjs idempoten, jadi duplikat dengan isi DB aman dan tidak ada yang hilang.

export const SERVER_BUS_ORIGIN = "server";
export const isServerBusOrigin = (origin: unknown) => origin === SERVER_BUS_ORIGIN;

export interface RedisBusOptions {
  // Koneksi KHUSUS subscriber (mode subscribe ioredis tidak bisa menjalankan perintah lain).
  subscriber: Redis;
  logger: Logger;
}

interface Subscription {
  document?: Document;
  // Update yang tiba sebelum dokumen selesai dimuat.
  pending: Uint8Array[];
}

export class RedisBusExtension implements Extension {
  // Harus berjalan sebelum PersistenceExtension (priority default 100).
  priority = 200;
  private readonly subscriptions = new Map<string, Subscription>();

  constructor(private readonly options: RedisBusOptions) {
    options.subscriber.on("messageBuffer", (channel: Buffer, message: Buffer) => {
      const name = channel.toString();
      if (!name.startsWith(DOCUMENT_UPDATE_CHANNEL_PREFIX)) return;
      this.receive(name.slice(DOCUMENT_UPDATE_CHANNEL_PREFIX.length), new Uint8Array(message));
    });
  }

  async onLoadDocument({ documentName }: onLoadDocumentPayload): Promise<void> {
    if (this.subscriptions.has(documentName)) return;
    this.subscriptions.set(documentName, { pending: [] });
    await this.options.subscriber.subscribe(documentUpdateChannel(documentName));
  }

  async afterLoadDocument({ documentName, document }: afterLoadDocumentPayload): Promise<void> {
    const subscription = this.subscriptions.get(documentName);
    if (!subscription) return;
    subscription.document = document;
    for (const update of subscription.pending.splice(0)) this.apply(documentName, document, update);
  }

  async afterUnloadDocument({ documentName }: { documentName: string }): Promise<void> {
    if (!this.subscriptions.delete(documentName)) return;
    await this.options.subscriber.unsubscribe(documentUpdateChannel(documentName));
  }

  async onDestroy(): Promise<void> {
    this.subscriptions.clear();
    await this.options.subscriber.quit();
  }

  private receive(documentName: string, update: Uint8Array): void {
    const subscription = this.subscriptions.get(documentName);
    if (!subscription) return;
    if (subscription.document) this.apply(documentName, subscription.document, update);
    else subscription.pending.push(update);
  }

  private apply(documentName: string, document: Document, update: Uint8Array): void {
    try {
      Y.applyUpdate(document, update, SERVER_BUS_ORIGIN);
    } catch (error) {
      // Payload rusak tidak boleh menjatuhkan instance; dokumen di DB tetap sumber kebenaran.
      this.options.logger.error({ err: error, docId: documentName }, "update redis-bus tidak bisa diterapkan");
    }
  }
}
