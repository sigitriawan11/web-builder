import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Extension, Hocuspocus, onConfigurePayload, onRequestPayload } from "@hocuspocus/server";
import { type Db, systemScope } from "@platform/db";
import { mergeDocumentUpdates } from "@platform/document-model";
import { UuidV7Schema } from "@platform/shared";
import { DOCUMENT_STATE_HEADERS, type DocumentStateSource, type ErrorBody } from "@platform/shared/contracts";
import { type InternalService, type Logger, verifyInternalToken } from "@platform/shared/node";
import * as Y from "yjs";
import { findDocumentMeta, loadStoredDocument } from "../persistence/documents.repository";
import type { PersistenceExtension } from "./persistence";

// ARCHITECTURE §5.5/§9.3: HTTP di port Hocuspocus yang sama.
// - `GET /health/live`, `GET /health/ready` (cek dependensi, mis. DB & Redis).
// - `GET /internal/documents/:id/state` (Bearer JWT internal `aud = "realtime"`, hanya worker & api): state Yjs biner
//   dengan kontrak header yang sama dengan api `/internal/v1/documents/:id/state`. Dokumen sedang dibuka → state
//   in-memory (`source: memory`, buffer persistence di-flush dulu sehingga state ⊇ semua update ≤ `seq`); tidak →
//   snapshot + update dari DB (`source: db`).

export type ReadinessCheck = () => Promise<unknown>;

export interface InternalHttpOptions {
  db: Db;
  logger: Logger;
  internalSecret: string;
  persistence?: PersistenceExtension;
  readinessChecks?: Readonly<Record<string, ReadinessCheck>>;
  readinessTimeoutMs?: number;
}

const ALLOWED_CALLERS: readonly InternalService[] = ["worker", "api"];
const STATE_PATH = /^\/internal\/documents\/([^/]+)\/state$/;

export class InternalHttpExtension implements Extension {
  private instance: Hocuspocus | undefined;

  constructor(private readonly options: InternalHttpOptions) {}

  async onConfigure({ instance }: onConfigurePayload): Promise<void> {
    this.instance = instance;
  }

  async onRequest({ request, response }: onRequestPayload): Promise<void> {
    const path = new URL(request.url ?? "/", "http://realtime.internal").pathname;
    if (!path.startsWith("/health/") && !path.startsWith("/internal/")) return;
    const requestId = headerValue(request, "x-request-id") ?? randomUUID();
    try {
      await this.route(request, response, path, requestId);
    } catch (error) {
      this.options.logger.error({ err: error, path, requestId }, "request internal realtime gagal");
      if (!response.headersSent) sendError(response, 500, "INTERNAL", "Terjadi kesalahan", requestId);
    }
    // `null` = sudah dijawab; Hocuspocus tidak menulis respons bawaannya.
    throw null;
  }

  private async route(request: IncomingMessage, response: ServerResponse, path: string, requestId: string) {
    if (request.method !== "GET")
      return sendError(response, 405, "METHOD_NOT_ALLOWED", "Metode tidak didukung", requestId);
    if (path === "/health/live") return sendJson(response, 200, { status: "ok" });
    if (path === "/health/ready") return this.ready(response);
    const match = STATE_PATH.exec(path);
    if (!match) return sendError(response, 404, "NOT_FOUND", "Tidak ditemukan", requestId);

    const token = (headerValue(request, "authorization") ?? "").replace(/^Bearer\s+/, "").trim();
    const verified = token
      ? await verifyInternalToken(this.options.internalSecret, token, { audience: "realtime" })
      : null;
    if (!verified?.ok) return sendError(response, 401, "UNAUTHENTICATED", "Token service tidak valid", requestId);
    if (!ALLOWED_CALLERS.includes(verified.value.sub)) {
      return sendError(response, 403, "FORBIDDEN", "Service tidak diizinkan", requestId);
    }
    const id = UuidV7Schema.safeParse(decodeURIComponent(match[1] ?? ""));
    if (!id.success) return sendError(response, 404, "NOT_FOUND", "Dokumen tidak ditemukan", requestId);
    return this.documentState(response, id.data, verified.value.sub, requestId);
  }

  private async documentState(response: ServerResponse, docId: string, caller: string, requestId: string) {
    const tenant = systemScope(`realtime internal: state dokumen untuk ${caller}`);
    this.options.logger.info({ docId, caller, requestId, reason: tenant.reason }, "akses dokumen lintas tenant");

    const live = this.instance?.documents.get(docId);
    let state: Uint8Array;
    let meta: { lastSeq: number; schemaVersion: number } | undefined;
    let source: DocumentStateSource;
    if (live && !live.isLoading) {
      await this.options.persistence?.flush(docId);
      meta = await findDocumentMeta(this.options.db, tenant, docId);
      state = Y.encodeStateAsUpdate(live);
      source = "memory";
    } else {
      const stored = await loadStoredDocument(this.options.db, tenant, docId);
      meta = stored;
      state = stored
        ? mergeDocumentUpdates([...(stored.snapshot ? [stored.snapshot.state] : []), ...stored.updates])
        : new Uint8Array();
      source = "db";
    }
    if (!meta) return sendError(response, 404, "NOT_FOUND", "Dokumen tidak ditemukan", requestId);
    response.writeHead(200, {
      "content-type": "application/octet-stream",
      "cache-control": "no-store",
      [DOCUMENT_STATE_HEADERS.seq]: String(meta.lastSeq),
      [DOCUMENT_STATE_HEADERS.schemaVersion]: String(meta.schemaVersion),
      [DOCUMENT_STATE_HEADERS.source]: source,
    });
    response.end(Buffer.from(state.buffer, state.byteOffset, state.byteLength));
  }

  private async ready(response: ServerResponse) {
    const timeoutMs = this.options.readinessTimeoutMs ?? 2_000;
    const entries = await Promise.all(
      Object.entries(this.options.readinessChecks ?? {}).map(async ([name, check]) => {
        const ok = await Promise.race([
          check().then(
            () => true,
            () => false,
          ),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs).unref()),
        ]);
        return [name, ok ? "ok" : "fail"] as const;
      }),
    );
    const ready = entries.every(([, result]) => result === "ok");
    sendJson(response, ready ? 200 : 503, {
      status: ready ? "ready" : "not_ready",
      checks: Object.fromEntries(entries),
    });
  }
}

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function sendError(response: ServerResponse, status: number, code: string, message: string, requestId: string): void {
  const body: ErrorBody = { error: { code, message, requestId } };
  sendJson(response, status, body);
}
