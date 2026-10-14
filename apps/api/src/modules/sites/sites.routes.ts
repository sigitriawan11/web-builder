import express, { type Router } from "express";
import type { Redis } from "../../lib/redis";
import { RATE_LIMITS, rateLimit } from "../../middleware/rate-limit";
import { validated } from "../../middleware/validate";
import { tenantRateLimitKey } from "../../tenant";
import { createSitesController } from "./sites.controller";
import {
  createSiteRequest,
  deleteSiteRequest,
  getSiteRequest,
  listSitesRequest,
  updateSiteRequest,
} from "./sites.schema";
import type { SitesService } from "./sites.service";

// Routing + middleware saja (CLAUDE.md § Struktur modul API). Dipasang router workspace di
// `/v1/workspaces/:workspaceId/sites` SETELAH tenantResolver (req.ctx.tenant sudah terverifikasi).

export interface SitesRouterDeps {
  service: SitesService;
  redis?: Redis;
}

export function createSitesRouter(deps: SitesRouterDeps): Router {
  const controller = createSitesController(deps.service);
  const router = express.Router({ mergeParams: true });
  if (deps.redis) {
    router.use(
      rateLimit(deps.redis, { name: "platform-api", windows: RATE_LIMITS.platformApi, key: tenantRateLimitKey }),
    );
  }
  router.get("/", ...validated(listSitesRequest, controller.list));
  router.post("/", ...validated(createSiteRequest, controller.create));
  router.get("/:siteId", ...validated(getSiteRequest, controller.get));
  router.patch("/:siteId", ...validated(updateSiteRequest, controller.update));
  router.delete("/:siteId", ...validated(deleteSiteRequest, controller.remove));
  return router;
}
