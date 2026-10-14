import express, { type Router } from "express";
import type { Redis } from "../../lib/redis";
import { requireAuth } from "../../middleware/auth-session";
import { byUserOrIp, RATE_LIMITS, rateLimit } from "../../middleware/rate-limit";
import { validated } from "../../middleware/validate";
import { createAccountController } from "./account.controller";
import {
  acceptConsentsRequest,
  getConsentsRequest,
  getProfileRequest,
  listSessionsRequest,
  revokeOtherSessionsRequest,
  revokeSessionRequest,
  updateProfileRequest,
} from "./account.schema";
import type { AccountService } from "./account.service";

// Routing + middleware saja. Dipasang di `/v1/account` (data milik user login, bukan tenant).

export interface AccountRouterDeps {
  service: AccountService;
  redis?: Redis;
  rateLimitPrefix?: string;
}

export function createAccountRouter(deps: AccountRouterDeps): Router {
  const controller = createAccountController(deps.service);
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
  router.get("/profile", ...validated(getProfileRequest, controller.getProfile));
  router.patch("/profile", ...validated(updateProfileRequest, controller.updateProfile));
  router.get("/consents", ...validated(getConsentsRequest, controller.getConsents));
  router.post("/consents", ...validated(acceptConsentsRequest, controller.acceptConsents));
  router.get("/sessions", ...validated(listSessionsRequest, controller.listSessions));
  router.post("/sessions/revoke-others", ...validated(revokeOtherSessionsRequest, controller.revokeOtherSessions));
  router.delete("/sessions/:sessionId", ...validated(revokeSessionRequest, controller.revokeSession));
  return router;
}
