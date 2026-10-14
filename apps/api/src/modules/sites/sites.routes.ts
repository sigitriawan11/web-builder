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

// Routing + middleware saja (CLAUDE.md § Struktur modul API), SETELAH tenantResolver (req.ctx.tenant terverifikasi):
// - koleksi `/v1/workspaces/:workspaceId/sites` (daftar, buat) — tenant workspace;
// - satu situs `/v1/sites/:siteId` (lihat, ganti nama, hapus) — tenant situs (ARCHITECTURE: rute level situs).

export interface SitesRouterDeps {
  service: SitesService;
  redis?: Redis;
}

function baseRouter(deps: SitesRouterDeps): Router {
  const router = express.Router({ mergeParams: true });
  if (deps.redis) {
    router.use(
      rateLimit(deps.redis, { name: "platform-api", windows: RATE_LIMITS.platformApi, key: tenantRateLimitKey }),
    );
  }
  return router;
}

export function createSitesRouter(deps: SitesRouterDeps): Router {
  const controller = createSitesController(deps.service);
  const router = baseRouter(deps);
  router.get("/", ...validated(listSitesRequest, controller.list));
  router.post("/", ...validated(createSiteRequest, controller.create));
  return router;
}

export function createSiteRouter(deps: SitesRouterDeps): Router {
  const controller = createSitesController(deps.service);
  const router = baseRouter(deps);
  router.get("/", ...validated(getSiteRequest, controller.get));
  router.patch("/", ...validated(updateSiteRequest, controller.update));
  router.delete("/", ...validated(deleteSiteRequest, controller.remove));
  return router;
}
