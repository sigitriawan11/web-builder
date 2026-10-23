import type { Db } from "@platform/db";
import type { Logger } from "@platform/shared/node";
import express, { type Router } from "express";
import type { Redis } from "../../lib/redis";
import { requireAuth } from "../../middleware/auth-session";
import { requireStaffRole } from "../../middleware/staff";
import { validated } from "../../middleware/validate";
import { createAiController } from "./ai.controller";
import { createRunRequest, runEventsRequest } from "./ai.schema";
import { createAiService } from "./ai.service";

// `/v1/ai` — run AI + SSE. M3: HANYA staf yang boleh edit draft library (AI-006 admin). Non-staf → 404 (permukaan
// tak bocor). Run user (mode user) = M6. Processor worker (AgentRunner → publish event) = follow-up.
const ADMIN_ROLES = ["super_admin", "library_admin", "designer"] as const;
const READ_ROLES = ["super_admin", "staff", "library_admin", "designer"] as const;

export function createAiRouter(deps: { db: Db; logger: Logger; redis?: Redis }): Router {
  const controller = createAiController(createAiService({ db: deps.db, logger: deps.logger }), deps.redis);
  const router = express.Router();
  const guard = (roles: readonly ("super_admin" | "staff" | "library_admin" | "designer")[]) => [
    requireAuth(),
    requireStaffRole(deps.db, roles),
  ];

  router.post("/runs", ...guard(ADMIN_ROLES), ...validated(createRunRequest, controller.create));
  router.get("/runs/:runId/events", ...guard(READ_ROLES), ...validated(runEventsRequest, controller.events));
  return router;
}
