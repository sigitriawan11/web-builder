import { type Db, systemScope } from "@platform/db";
import { mergeDocumentUpdates } from "@platform/document-model";
import { AppError, UuidV7Schema } from "@platform/shared";
import { DOCUMENT_STATE_HEADERS } from "@platform/shared/contracts";
import type { Logger } from "@platform/shared/node";
import express, { type Router } from "express";
import { allowServices } from "../service-token";
import { loadStoredDocumentState } from "./documents.repository";

// `GET /internal/v1/documents/:id/state` (ARCHITECTURE §5.5): state Yjs terbaru untuk worker (AI, publish) &
// realtime. Sumber saat ini = DB (snapshot + update setelahnya); dokumen yang sedang dibuka di realtime (in-memory)
// dilayani apps/realtime `internal-http` (T1.12) dengan kontrak header yang sama.

export function createInternalDocumentsRouter(deps: { db: Db; logger: Logger }): Router {
  const router = express.Router();
  router.get("/:id/state", allowServices("worker", "realtime"), async (req, res) => {
    const id = UuidV7Schema.safeParse(req.params.id);
    if (!id.success) throw new AppError("NOT_FOUND");
    const caller = req.service?.sub ?? "unknown";
    const tenant = systemScope(`internal: state dokumen untuk ${caller}`);
    deps.logger.info({ documentId: id.data, caller, reason: tenant.reason }, "akses dokumen lintas tenant");

    const stored = await loadStoredDocumentState(deps.db, tenant, id.data);
    if (!stored) throw new AppError("NOT_FOUND");
    const state = mergeDocumentUpdates([...(stored.snapshot ? [stored.snapshot.state] : []), ...stored.updates]);
    res
      .status(200)
      .set({
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
        [DOCUMENT_STATE_HEADERS.seq]: String(stored.lastSeq),
        [DOCUMENT_STATE_HEADERS.schemaVersion]: String(stored.schemaVersion),
        [DOCUMENT_STATE_HEADERS.source]: "db",
      })
      .end(Buffer.from(state.buffer, state.byteOffset, state.byteLength));
  });
  return router;
}
