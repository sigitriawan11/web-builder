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
  draftDefinitionRequest,
  editorSessionRequest,
  publishRequest,
  realtimeTokenRequest,
  saveDraftRequest,
  usageRequest,
} from "./library-admin.schema";
import { createLibraryAdminService } from "./library-admin.service";

// `/v1/admin/library` — CRUD admin library platform (CMP-159/CMP-010). Wajib login + role staf; non-staf → 404
// (permukaan admin tidak bocor). Matriks role (CMP-010 §tabel): BACA = semua staf (`staff` read-only); EDIT DRAFT =
// designer/library_admin/super_admin; PUBLISH/deprecate/archive = library_admin/super_admin. Tiap mutasi tulis audit.
// Catatan scope: endpoint QA/submit/review (tabel P1 T3.3.6 + worker QA), yank/rollback (trigger immutable → keputusan
// owner), templates & CRUD themes, enqueue thumbnail/notify (M4) menyusul.
const READ_ROLES = ["super_admin", "staff", "library_admin", "designer"] as const;
const DRAFT_ROLES = ["super_admin", "library_admin", "designer"] as const;
const PUBLISH_ROLES = ["super_admin", "library_admin"] as const;

export function createLibraryAdminRouter(deps: {
  db: Db;
  logger: Logger;
  realtime?: { tokenSecret: string; url: string };
  redis?: Redis;
  rateLimitPrefix?: string;
}): Router {
  const controller = createLibraryAdminController(
    createLibraryAdminService({
      db: deps.db,
      logger: deps.logger,
      ...(deps.realtime ? { realtime: deps.realtime } : {}),
    }),
  );
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
  const guard = (roles: readonly ("super_admin" | "staff" | "library_admin" | "designer")[]) => [
    requireAuth(),
    requireStaffRole(deps.db, roles),
    ...limiter,
  ];

  router.post("/components", ...guard(DRAFT_ROLES), ...validated(createComponentRequest, controller.create));
  router.put("/components/:id/draft", ...guard(DRAFT_ROLES), ...validated(saveDraftRequest, controller.saveDraft));
  router.post(
    "/components/:id/draft/publish",
    ...guard(PUBLISH_ROLES),
    ...validated(publishRequest, controller.publish),
  );
  router.post(
    "/components/:id/deprecate",
    ...guard(PUBLISH_ROLES),
    ...validated(deprecateRequest, controller.deprecate),
  );
  router.post("/components/:id/archive", ...guard(PUBLISH_ROLES), ...validated(archiveRequest, controller.archive));
  router.get("/components/:id/usage", ...guard(READ_ROLES), ...validated(usageRequest, controller.usage));
  router.get("/components/:id", ...guard(READ_ROLES), ...validated(editorSessionRequest, controller.editorSession));
  // Definisi draft by public_id (registry editor me-resolve instance draft, CMP-011) — path terpisah dari `:id` UUID.
  router.get(
    "/component-drafts/:componentId",
    ...guard(READ_ROLES),
    ...validated(draftDefinitionRequest, controller.draftDefinition),
  );
  // Token realtime draft component (D3) — semua staf (viewer = read-only).
  router.post(
    "/components/:id/realtime-token",
    ...guard(READ_ROLES),
    ...validated(realtimeTokenRequest, controller.realtimeToken),
  );
  return router;
}
