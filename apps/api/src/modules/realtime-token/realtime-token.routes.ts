import express, { type Router } from "express";
import type { Redis } from "../../lib/redis";
import { requireAuth } from "../../middleware/auth-session";
import { byUserOrIp, RATE_LIMITS, rateLimit } from "../../middleware/rate-limit";
import { validated } from "../../middleware/validate";
import { createRealtimeTokenController } from "./realtime-token.controller";
import { issueRealtimeTokenRequest } from "./realtime-token.schema";
import type { RealtimeTokenService } from "./realtime-token.service";

// Routing saja. Dipasang di `/v1/realtime`. Akses dokumen diperiksa service (dokumen → situs → keanggotaan), karena
// ID dokumen ada di body, bukan di path tenant.

export function createRealtimeTokenRouter(deps: {
  service: RealtimeTokenService;
  redis?: Redis;
  rateLimitPrefix?: string;
}): Router {
  const controller = createRealtimeTokenController(deps.service);
  const router = express.Router();
  router.use(requireAuth());
  if (deps.redis) {
    router.use(
      rateLimit(
        deps.redis,
        { name: "platform-api", windows: RATE_LIMITS.platformApi, key: byUserOrIp },
        deps.rateLimitPrefix ? { keyPrefix: deps.rateLimitPrefix } : {},
      ),
    );
  }
  router.post("/token", ...validated(issueRealtimeTokenRequest, controller.issue));
  return router;
}
