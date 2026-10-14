import type { Actor, SiteTenant, WorkspaceTenant } from "@platform/db";
import { type Action, AppError, can, type PermissionResource } from "@platform/shared";
import type { RequestHandler } from "express";

// Penegakan matriks izin ACC-033 di api. Aktor `user` & `ai` (atas nama user yang memulai run) memakai role
// workspace; staf platform (impersonation) hanya boleh membaca (spec 08 §10, default read-only).

export function canActor(actor: Actor, action: Action, resource?: PermissionResource): boolean {
  if (actor.type === "staff") return action.endsWith(".read");
  return can({ role: actor.role, userId: actor.userId }, action, resource);
}

/** Lempar 403 FORBIDDEN bila tidak boleh (role kurang di tenant sendiri; tenant lain sudah 404 di tenantResolver). */
export function assertCan(tenant: WorkspaceTenant | SiteTenant, action: Action, resource?: PermissionResource): void {
  if (!canActor(tenant.actor, action, resource)) throw new AppError("FORBIDDEN", undefined, { action });
}

/** Middleware per route (setelah tenantResolver): `router.post("/", requirePermission("site.create"), …)`. */
export function requirePermission(action: Action): RequestHandler {
  return (req, _res, next) => {
    const tenant = req.ctx.tenant;
    // Tanpa tenant = urutan middleware salah (bug), bukan kondisi user.
    if (!tenant) throw new Error(`requirePermission(${action}) dipasang tanpa tenantResolver`);
    assertCan(tenant, action);
    next();
  };
}
