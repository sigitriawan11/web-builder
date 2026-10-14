import { type Db, siteScope, workspaceScope } from "@platform/db";
import { AppError, UuidV7Schema } from "@platform/shared";
import { updateContext } from "@platform/shared/node";
import type { RequestHandler } from "express";
import { findMembership, findSiteMembership } from "../modules/workspaces/workspaces.repository";

// Middleware 8 (ARCHITECTURE §5.3, §9.5): `:workspaceId` / `:siteId` + user login → cek keanggotaan → isi
// `req.ctx.tenant` (role dari `workspace_members`). Satu-satunya tempat tenant dibuat dari request. Bukan anggota,
// tidak ada, dihapus, atau ID tidak valid → 404 (keberadaan resource tenant lain tidak bocor). Belum login → 401.

export type TenantScope = "workspace" | "site";

// Penanda middleware untuk test inventaris rute (ARCHITECTURE §9.5): rute tenant wajib melewati tenantResolver.
export const TENANT_RESOLVER_TAG = Symbol.for("platform.tenantResolver");

export function tenantResolver(deps: { db: Db; scope?: TenantScope }): RequestHandler {
  const scope = deps.scope ?? "workspace";
  const middleware: RequestHandler = async (req, _res, next) => {
    const user = req.ctx.user;
    if (!user) throw new AppError("UNAUTHENTICATED");
    const param = scope === "workspace" ? req.params.workspaceId : req.params.siteId;
    const id = UuidV7Schema.safeParse(param);
    if (!id.success) throw new AppError("NOT_FOUND");

    const membership =
      scope === "workspace"
        ? await findMembership(deps.db, user.id, id.data)
        : await findSiteMembership(deps.db, user.id, id.data);
    if (!membership) throw new AppError("NOT_FOUND");

    const actor = { type: "user" as const, userId: user.id, role: membership.role };
    if (scope === "workspace") {
      req.ctx.tenant = workspaceScope({ workspaceId: membership.workspaceId, actor });
      updateContext({ workspaceId: membership.workspaceId });
    } else {
      req.ctx.tenant = siteScope({ workspaceId: membership.workspaceId, siteId: id.data, actor });
      updateContext({ workspaceId: membership.workspaceId, siteId: id.data });
    }
    next();
  };
  return Object.assign(middleware, { [TENANT_RESOLVER_TAG]: scope });
}
