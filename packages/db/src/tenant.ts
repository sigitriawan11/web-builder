import { UuidV7Schema } from "@platform/shared";
import { WorkspaceRoleSchema } from "@platform/shared/contracts";
import { and, eq, isNull, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";

// Isolasi tenant di repository layer (ARCHITECTURE §6.2, CLAUDE.md § Multi-tenant). Setiap fungsi repository
// menerima tenant sebagai parameter pertama dan memfilter dengannya. Tipe tenant di-brand: hanya bisa dibuat
// lewat `siteScope`/`workspaceScope`/`systemScope`, sehingga objek dari body request atau output AI tidak bisa
// dipakai langsung. Yang memanggil scope (middleware tenantResolver, worker) wajib sudah memverifikasi akses.

declare const tenantBrand: unique symbol;
type Branded<T, B extends string> = T & { readonly [tenantBrand]: B };

export const ActorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("user"), userId: UuidV7Schema, role: WorkspaceRoleSchema }),
  // Perubahan AI masuk atas nama user yang memulai run (spec 04).
  z.object({ type: z.literal("ai"), userId: UuidV7Schema, role: WorkspaceRoleSchema, runId: UuidV7Schema }),
  // Staf platform (admin panel/impersonation, spec 08 §10).
  z.object({ type: z.literal("staff"), userId: UuidV7Schema }),
]);
export type Actor = z.infer<typeof ActorSchema>;

export type SiteTenant = Branded<{ kind: "site"; workspaceId: string; siteId: string; actor: Actor }, "site">;
export type WorkspaceTenant = Branded<{ kind: "workspace"; workspaceId: string; actor: Actor }, "workspace">;
// Worker/cron lintas tenant: alasan wajib dan ikut tercatat di log.
export type SystemTenant = Branded<{ kind: "system"; reason: string }, "system">;
export type TenantContext = SiteTenant | WorkspaceTenant | SystemTenant;

const SiteScopeSchema = z.object({ workspaceId: UuidV7Schema, siteId: UuidV7Schema, actor: ActorSchema });
const WorkspaceScopeSchema = z.object({ workspaceId: UuidV7Schema, actor: ActorSchema });

export function siteScope(input: { workspaceId: string; siteId: string; actor: Actor }): SiteTenant {
  return Object.freeze({ kind: "site", ...SiteScopeSchema.parse(input) }) as SiteTenant;
}

export function workspaceScope(input: { workspaceId: string; actor: Actor }): WorkspaceTenant {
  return Object.freeze({ kind: "workspace", ...WorkspaceScopeSchema.parse(input) }) as WorkspaceTenant;
}

export function systemScope(reason: string): SystemTenant {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error('systemScope wajib menyertakan alasan (mis. "cleanup: compaction dokumen")');
  return Object.freeze({ kind: "system", reason: trimmed }) as SystemTenant;
}

/** Filter baris milik situs tenant; tabel yang juga punya `workspaceId` ikut difilter (defense-in-depth). */
export function siteWhere(tenant: SiteTenant, table: { siteId: PgColumn; workspaceId?: PgColumn }): SQL {
  const bySite = eq(table.siteId, tenant.siteId);
  return table.workspaceId ? (and(bySite, eq(table.workspaceId, tenant.workspaceId)) as SQL) : bySite;
}

/** Filter baris milik workspace tenant (berlaku juga untuk tenant situs). */
export function workspaceWhere(tenant: SiteTenant | WorkspaceTenant, table: { workspaceId: PgColumn }): SQL {
  return eq(table.workspaceId, tenant.workspaceId);
}

/** Baris yang belum di-soft-delete. */
export function notDeleted(table: { deletedAt: PgColumn }): SQL {
  return isNull(table.deletedAt);
}

/** Field log tenant (gabungkan ke log/audit; alasan system scope selalu tercatat). */
export function tenantLogFields(tenant: TenantContext): Record<string, string> {
  switch (tenant.kind) {
    case "site":
      return { tenant: "site", workspaceId: tenant.workspaceId, siteId: tenant.siteId, actorType: tenant.actor.type };
    case "workspace":
      return { tenant: "workspace", workspaceId: tenant.workspaceId, actorType: tenant.actor.type };
    case "system":
      return { tenant: "system", systemReason: tenant.reason };
  }
}
