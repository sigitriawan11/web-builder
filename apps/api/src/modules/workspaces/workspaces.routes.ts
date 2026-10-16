import type { Db } from "@platform/db";
import { AppError, permissionsFor } from "@platform/shared";
import type { WorkspaceListItem, WorkspaceMe } from "@platform/shared/contracts";
import express, { type Router } from "express";
import { mountAt } from "../../lib/mount";
import type { Redis } from "../../lib/redis";
import { requireAuth } from "../../middleware/auth-session";
import { byUserOrIp, RATE_LIMITS, rateLimit } from "../../middleware/rate-limit";
import { tenantResolver } from "../../middleware/tenant-resolver";
import { requireWorkspaceTenant } from "../../tenant";
import { createSitesRouter } from "../sites/sites.routes";
import { createSitesService } from "../sites/sites.service";
import { findWorkspaceSummary, listUserWorkspaces } from "./workspaces.repository";

// Router `/v1/workspaces/:workspaceId/*`: login → tenantResolver (keanggotaan + role) → sub-router fitur.
// Semua rute tenant workspace dipasang DI SINI agar tidak ada yang lolos tanpa tenantResolver (ARCHITECTURE §9.5).

export function createWorkspaceRouter(deps: { db: Db; redis?: Redis }): Router {
  const router = express.Router({ mergeParams: true });
  router.use(requireAuth(), tenantResolver({ db: deps.db }));

  // Role & izin user di workspace ini (ACC-033: UI menyembunyikan aksi yang tidak diizinkan).
  router.get("/me", async (req, res) => {
    const tenant = requireWorkspaceTenant(req);
    const workspace = await findWorkspaceSummary(deps.db, tenant.workspaceId);
    if (!workspace || tenant.actor.type === "staff") throw new AppError("NOT_FOUND");
    const data: WorkspaceMe = { workspace, role: tenant.actor.role, permissions: permissionsFor(tenant.actor.role) };
    res.json({ data, meta: { requestId: req.ctx.requestId } });
  });

  mountAt(
    router,
    "/sites",
    createSitesRouter({ service: createSitesService({ db: deps.db }), ...(deps.redis ? { redis: deps.redis } : {}) }),
  );
  return router;
}

/**
 * `GET /v1/workspaces` — daftar keanggotaan user login (switcher dashboard, T1.14.5). Bukan rute tenant: query di-scope
 * `userId` sesi, tidak pernah dari input. Rute lain di bawah `/v1/workspaces/:workspaceId` diteruskan ke router tenant.
 */
export function createWorkspacesListRouter(deps: { db: Db; redis?: Redis; rateLimitPrefix?: string }): Router {
  const router = express.Router();
  router.get(
    "/",
    requireAuth(),
    ...(deps.redis
      ? [
          rateLimit(
            deps.redis,
            { name: "platform-api", windows: RATE_LIMITS.platformApi, key: byUserOrIp },
            deps.rateLimitPrefix ? { keyPrefix: deps.rateLimitPrefix } : {},
          ),
        ]
      : []),
    async (req, res) => {
      const userId = req.ctx.user?.id;
      if (!userId) throw new AppError("UNAUTHENTICATED");
      const data: WorkspaceListItem[] = await listUserWorkspaces(deps.db, userId);
      res.json({ data, meta: { requestId: req.ctx.requestId, nextCursor: null } });
    },
  );
  return router;
}
