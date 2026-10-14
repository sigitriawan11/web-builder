import type { Db } from "@platform/db";
import express, { type Router } from "express";
import type { Redis } from "../../lib/redis";
import { requireAuth } from "../../middleware/auth-session";
import { tenantResolver } from "../../middleware/tenant-resolver";
import { createSiteRouter } from "./sites.routes";
import { createSitesService } from "./sites.service";

// Router `/v1/sites/:siteId/*`: login → tenantResolver cakupan situs (situs → workspace → keanggotaan & role) →
// sub-router level situs. Fitur level situs berikutnya (AI runs, realtime token, …) dipasang DI SINI agar semua
// lewat tenantResolver (ARCHITECTURE §9.5).

export function createSiteScopeRouter(deps: { db: Db; redis?: Redis }): Router {
  const router = express.Router({ mergeParams: true });
  router.use(requireAuth(), tenantResolver({ db: deps.db, scope: "site" }));
  router.use(
    "/",
    createSiteRouter({ service: createSitesService({ db: deps.db }), ...(deps.redis ? { redis: deps.redis } : {}) }),
  );
  return router;
}
