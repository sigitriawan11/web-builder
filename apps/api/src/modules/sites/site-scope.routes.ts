import type { Db } from "@platform/db";
import express, { type Router } from "express";
import { mountAt } from "../../lib/mount";
import type { Redis } from "../../lib/redis";
import type { AssetStorage } from "../../lib/storage";
import { requireAuth } from "../../middleware/auth-session";
import { tenantResolver } from "../../middleware/tenant-resolver";
import type { QueueProducer } from "../../queues/producer";
import { createAssetsRouter } from "../assets/assets.routes";
import { createAssetsService } from "../assets/assets.service";
import { createSiteRouter } from "./sites.routes";
import { createSitesService } from "./sites.service";

// Router `/v1/sites/:siteId/*`: login → tenantResolver cakupan situs (situs → workspace → keanggotaan & role) →
// sub-router level situs. Fitur level situs berikutnya (AI runs, realtime token, …) dipasang DI SINI agar semua
// lewat tenantResolver (ARCHITECTURE §9.5).

export function createSiteScopeRouter(deps: {
  db: Db;
  redis?: Redis;
  storage?: AssetStorage;
  queues?: QueueProducer;
}): Router {
  const router = express.Router({ mergeParams: true });
  router.use(requireAuth(), tenantResolver({ db: deps.db, scope: "site" }));
  mountAt(
    router,
    "/",
    createSiteRouter({ service: createSitesService({ db: deps.db }), ...(deps.redis ? { redis: deps.redis } : {}) }),
  );
  // Upload aset (ARCHITECTURE §9.9) hanya bila object storage dikonfigurasi (server; test bisa inject fake).
  if (deps.storage) {
    mountAt(
      router,
      "/assets",
      createAssetsRouter({
        service: createAssetsService({
          db: deps.db,
          storage: deps.storage,
          ...(deps.queues ? { queues: deps.queues } : {}),
        }),
        ...(deps.redis ? { redis: deps.redis } : {}),
      }),
    );
  }
  return router;
}
