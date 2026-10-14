import { type Extension, Server } from "@hocuspocus/server";
import type { Logger } from "@platform/shared/node";
import { authenticateConnection, RealtimeAuthError, type RealtimeContext } from "./auth";

// ARCHITECTURE §5.5: Hocuspocus sebagai jalur sinkronisasi & autosave dokumen sejak M1 (single-editor).
// Extension (persistence, lock, projections, redis-bus, internal-http) ditambah di T1.12.2–T1.12.9.

export interface RealtimeServerOptions {
  port: number;
  host?: string;
  tokenSecret: string;
  logger: Logger;
  extensions?: Extension[];
  now?: () => number;
}

export function createRealtimeServer(options: RealtimeServerOptions): Server<RealtimeContext> {
  return new Server<RealtimeContext>({
    port: options.port,
    ...(options.host ? { address: options.host } : {}),
    quiet: true,
    // Shutdown dikelola main.ts (flush persistence dulu).
    stopOnSignals: false,
    extensions: options.extensions ?? [],
    async onAuthenticate({ token, documentName, connectionConfig, socketId }) {
      try {
        const context = await authenticateConnection(options.tokenSecret, token, documentName, options.now);
        // Viewer (preview) boleh tersambung tetapi tidak boleh menulis (ARCHITECTURE §5.5).
        if (context.role === "viewer") connectionConfig.readOnly = true;
        options.logger.debug(
          { socketId, docId: context.docId, userId: context.userId },
          "koneksi realtime diautentikasi",
        );
        return context;
      } catch (error) {
        if (error instanceof RealtimeAuthError) {
          options.logger.warn({ socketId, documentName, reason: error.failure }, "koneksi realtime ditolak");
        }
        throw error;
      }
    },
  });
}
