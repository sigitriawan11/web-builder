import type { Db } from "@platform/db";
import type { Logger } from "@platform/shared/node";
import express, { type Router } from "express";
import { createInternalDocumentsRouter } from "./documents/documents.routes";
import { requireServiceToken } from "./service-token";

// Router `/internal/v1` (ARCHITECTURE §5.3, §9.3): host resolve, doc state, callback job — ditambah bersama fiturnya.
// Selain token, sebaiknya juga dibatasi jaringan (private network / allowlist) di infrastruktur.
export function createInternalRouter(deps: { internalJwtSecret: string; db?: Db; logger?: Logger }): Router {
  const router = express.Router();
  router.use(requireServiceToken(deps.internalJwtSecret));
  // Cek konektivitas & token antar service.
  router.get("/ping", (req, res) => {
    res.json({ data: { service: req.service?.sub }, meta: { requestId: req.ctx.requestId } });
  });
  if (deps.db && deps.logger)
    router.use("/documents", createInternalDocumentsRouter({ db: deps.db, logger: deps.logger }));
  return router;
}
