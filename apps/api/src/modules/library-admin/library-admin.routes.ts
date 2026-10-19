import type { Db } from "@platform/db";
import type { Logger } from "@platform/shared/node";
import express, { type Router } from "express";
import type { Redis } from "../../lib/redis";
import { requireAuth } from "../../middleware/auth-session";
import { byUserOrIp, RATE_LIMITS, rateLimit } from "../../middleware/rate-limit";
import { requireStaffRole } from "../../middleware/staff";
import { validated } from "../../middleware/validate";
import { createLibraryAdminController } from "./library-admin.controller";
import {
  archiveRequest,
  createComponentRequest,
  deprecateRequest,
  publishRequest,
  saveDraftRequest,
  usageRequest,
} from "./library-admin.schema";
import { createLibraryAdminService } from "./library-admin.service";

// `/v1/admin/library` — CRUD admin library platform (CMP-159). Wajib login + role staf (`super_admin`/`library_admin`);
// non-staf → 404 (permukaan admin tidak bocor). Setiap mutasi menulis `audit_logs`.
// Catatan scope (2026-10-19): endpoint QA/submit/review (butuh tabel review/QA T3.3.6 P1 + worker QA), yank/rollback
// (trigger immutable menolak UPDATE baris published → butuh pengecualian toggle `yanked`; diajukan ke owner), templates
// (belum dimodelkan) & CRUD themes menyusul. Enqueue thumbnail/notify saat publish menanti job-nya (M4).
export function createLibraryAdminRouter(deps: {
  db: Db;
  logger: Logger;
  redis?: Redis;
  rateLimitPrefix?: string;
}): Router {
  const controller = createLibraryAdminController(createLibraryAdminService({ db: deps.db, logger: deps.logger }));
  const router = express.Router();
  const gate = [requireAuth(), requireStaffRole(deps.db, ["super_admin", "library_admin"])];
  const limiter = deps.redis
    ? [
        rateLimit(
          deps.redis,
          { name: "platform-api", windows: RATE_LIMITS.platformApi, key: byUserOrIp },
          deps.rateLimitPrefix ? { keyPrefix: deps.rateLimitPrefix } : {},
        ),
      ]
    : [];
  const guard = [...gate, ...limiter];

  router.post("/components", ...guard, ...validated(createComponentRequest, controller.create));
  router.put("/components/:id/draft", ...guard, ...validated(saveDraftRequest, controller.saveDraft));
  router.post("/components/:id/draft/publish", ...guard, ...validated(publishRequest, controller.publish));
  router.post("/components/:id/deprecate", ...guard, ...validated(deprecateRequest, controller.deprecate));
  router.post("/components/:id/archive", ...guard, ...validated(archiveRequest, controller.archive));
  router.get("/components/:id/usage", ...guard, ...validated(usageRequest, controller.usage));
  return router;
}
