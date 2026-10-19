import type { Db } from "@platform/db";
import { AppError } from "@platform/shared";
import type { RequestHandler } from "express";
import { findStaffRole, type StaffRole } from "./staff.repository";

export type { StaffRole };

// Gerbang role staf platform (spec 08 §10.1, CMP-010). Role staf TIDAK ikut di sesi (`req.ctx.user` hanya identitas) →
// dibaca dari DB per request (endpoint admin bervolume rendah). Bukan staf berwenang → **404**, bukan 403: keberadaan
// permukaan admin tidak boleh bocor ke user biasa (sejajar NOT_FOUND resource tenant lain).
export function requireStaffRole(db: Db, roles: readonly StaffRole[]): RequestHandler {
  const allowed = new Set<StaffRole>(roles);
  return async (req, _res, next) => {
    const user = req.ctx.user;
    if (!user) throw new AppError("UNAUTHENTICATED");
    const staffRole = await findStaffRole(db, user.id);
    if (!staffRole || !allowed.has(staffRole)) throw new AppError("NOT_FOUND");
    next();
  };
}
