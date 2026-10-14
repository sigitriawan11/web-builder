import type { WorkspaceRole } from "./contracts/workspaces";

// Matriks role & izin workspace (spec 08 ACC-033). Satu sumber untuk api (requirePermission), web, dan editor
// (menyembunyikan aksi). Role tetap; personal workspace = user owner implisit.

export const ACTIONS = [
  "site.read",
  "site.create",
  "site.edit",
  "site.publish",
  "site.delete",
  "site.domain",
  "site.transfer",
  "site.comment",
  "ai.use",
  "data.read",
  "data.schema",
  "data.export",
  "data.members",
  "payments.config",
  "commerce.products",
  "commerce.orders",
  "billing.read",
  "billing.manage",
  "billing.cancel",
  "members.read",
  "members.manage",
  "workspace.update",
  "workspace.delete",
  "workspace.transfer",
] as const;
export type Action = (typeof ACTIONS)[number];

/**
 * Isi sel matriks: `true` boleh, `false` tidak, atau aturan terbatas (🔸 di spec):
 * - `own`: hanya resource buatan user sendiri (`resource.createdBy`).
 * - `below_admin`: hanya target ber-role di bawah admin (admin tidak bisa mengelola owner / admin lain).
 */
type Rule = boolean | "own" | "below_admin";

const ROLES = ["owner", "admin", "editor", "viewer", "billing"] as const;
type Row = readonly [owner: Rule, admin: Rule, editor: Rule, viewer: Rule, billing: Rule];

// Urutan kolom = ROLES. Disalin dari tabel ACC-033; catatan non-boolean di komentar.
const MATRIX: Readonly<Record<Action, Row>> = {
  "site.read": [true, true, true, true, false], // viewer: read-only
  "site.create": [true, true, true, false, false],
  "site.edit": [true, true, true, false, false],
  "site.publish": [true, true, true, false, false],
  "site.delete": [true, true, "own", false, false], // arsip/hapus/restore; editor: site buatannya
  "site.domain": [true, true, false, false, false],
  "site.transfer": [true, false, false, false, false],
  "site.comment": [true, true, true, true, false],
  "ai.use": [true, true, true, false, false],
  // viewer 🔸 "tanpa PII" (❓ OPEN spec 08): boleh baca; penyamaran PII tanggung jawab modul data (M7).
  "data.read": [true, true, true, true, false],
  "data.schema": [true, true, true, false, false],
  "data.export": [true, true, false, false, false],
  // Kelola member end-user situs; editor 🔸 "lihat saja" → baca lewat data.read.
  "data.members": [true, true, false, false, false],
  "payments.config": [true, true, false, false, false], // admin: wajib re-auth di route
  "commerce.products": [true, true, true, false, false],
  "commerce.orders": [true, true, false, false, false],
  "billing.read": [true, true, false, false, true],
  "billing.manage": [true, false, false, false, true],
  "billing.cancel": [true, false, false, false, false],
  "members.read": [true, true, true, true, true],
  "members.manage": [true, "below_admin", false, false, false],
  "workspace.update": [true, true, false, false, false],
  "workspace.delete": [true, false, false, false, false],
  "workspace.transfer": [true, false, false, false, false],
};

export interface PermissionActor {
  role: WorkspaceRole;
  userId: string;
}

export interface PermissionResource {
  // Pembuat resource (site) — untuk aturan `own`.
  createdBy?: string | null;
  // Role anggota yang dikelola — untuk aturan `below_admin`.
  targetRole?: WorkspaceRole;
}

/**
 * Boleh melakukan `action`? Aturan terbatas tanpa data resource yang dibutuhkan → ditolak (fail closed).
 */
export function can(actor: PermissionActor, action: Action, resource: PermissionResource = {}): boolean {
  const rule = MATRIX[action][ROLES.indexOf(actor.role)];
  if (rule === "own") return resource.createdBy != null && resource.createdBy === actor.userId;
  if (rule === "below_admin") {
    return resource.targetRole !== undefined && resource.targetRole !== "owner" && resource.targetRole !== "admin";
  }
  return rule === true;
}

/**
 * Daftar aksi yang (setidaknya sebagian) boleh untuk role — untuk UI (`GET /workspaces/:id/me`, ACC-033):
 * aksi terbatas ikut, keputusan akhir per resource tetap di server.
 */
export function permissionsFor(role: WorkspaceRole): Action[] {
  return ACTIONS.filter((action) => MATRIX[action][ROLES.indexOf(role)] !== false);
}
