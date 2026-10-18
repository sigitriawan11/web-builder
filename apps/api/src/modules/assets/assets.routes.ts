import express, { type Router } from "express";
import type { Redis } from "../../lib/redis";
import { RATE_LIMITS, rateLimit } from "../../middleware/rate-limit";
import { validated } from "../../middleware/validate";
import { tenantRateLimitKey } from "../../tenant";
import { createAssetsController } from "./assets.controller";
import { completeRequest, getAssetRequest, presignRequest } from "./assets.schema";
import type { AssetsService } from "./assets.service";

// `/v1/sites/:siteId/assets` — upload aset (ARCHITECTURE §9.9), SETELAH tenantResolver cakupan situs.

export function createAssetsRouter(deps: { service: AssetsService; redis?: Redis }): Router {
  const controller = createAssetsController(deps.service);
  const router = express.Router({ mergeParams: true });
  if (deps.redis) {
    router.use(
      rateLimit(deps.redis, { name: "platform-api", windows: RATE_LIMITS.platformApi, key: tenantRateLimitKey }),
    );
  }
  router.post("/", ...validated(presignRequest, controller.presign));
  router.post("/:assetId/complete", ...validated(completeRequest, controller.complete));
  router.get("/:assetId", ...validated(getAssetRequest, controller.get));
  return router;
}
