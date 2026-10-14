import type { SiteTenant, WorkspaceTenant } from "@platform/db";
import type { Request } from "express";

// Tenant per request (ARCHITECTURE §6.2): diisi middleware tenantResolver (T1.5) setelah memverifikasi membership,
// tidak pernah dari body/query. Controller membaca lewat helper di bawah.

/** Tenant request (workspace atau situs — keduanya memuat workspaceId). Tidak ada → bug susunan router (500). */
export function requireWorkspaceTenant(req: Request): WorkspaceTenant | SiteTenant {
  const tenant = req.ctx.tenant;
  if (!tenant) throw new Error(`Rute ${req.method} ${req.baseUrl}${req.path} dipanggil tanpa middleware tenant`);
  return tenant;
}

/** Tenant situs (rute `/v1/sites/:siteId/*`, tenantResolver cakupan `site`). Tidak ada → bug susunan router. */
export function requireSiteTenant(req: Request): SiteTenant {
  const tenant = req.ctx.tenant;
  if (tenant?.kind !== "site") {
    throw new Error(`Rute ${req.method} ${req.baseUrl}${req.path} butuh tenant situs (tenantResolver scope "site")`);
  }
  return tenant;
}

/** Kunci rate limit platform API: user yang login (§9.6), selain itu IP. */
export function tenantRateLimitKey(req: Request): string {
  const tenant = req.ctx.tenant;
  return tenant && tenant.actor.type !== "staff" ? `user:${tenant.actor.userId}` : `ip:${req.ip ?? "unknown"}`;
}

export type { SiteTenant, WorkspaceTenant };
