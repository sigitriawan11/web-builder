import type { Db } from "@platform/db";
import express, { type Router } from "express";
import type { Redis } from "../../lib/redis";
import { requireAuth } from "../../middleware/auth-session";
import { byUserOrIp, RATE_LIMITS, rateLimit } from "../../middleware/rate-limit";
import { validated } from "../../middleware/validate";
import { createLibraryController } from "./library.controller";
import { getDefinitionRequest } from "./library.schema";
import { createLibraryService } from "./library.service";

// `/v1/library` — baca library platform (CMP-158 subset). Global (bukan tenant); wajib login. Hanya baca versi
// published; tulis (admin) = modul terpisah dengan role platform_admin.
export function createLibraryRouter(deps: { db: Db; redis?: Redis; rateLimitPrefix?: string }): Router {
  const controller = createLibraryController(createLibraryService({ db: deps.db }));
  const router = express.Router();
  const limiter = deps.redis
    ? [
        rateLimit(
          deps.redis,
          { name: "platform-api", windows: RATE_LIMITS.platformApi, key: byUserOrIp },
          deps.rateLimitPrefix ? { keyPrefix: deps.rateLimitPrefix } : {},
        ),
      ]
    : [];
  router.get(
    "/components/:componentId/versions/:version",
    requireAuth(),
    ...limiter,
    ...validated(getDefinitionRequest, controller.getDefinition),
  );
  return router;
}
