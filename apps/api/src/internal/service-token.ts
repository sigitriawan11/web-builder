import { AppError } from "@platform/shared";
import { type InternalClaims, verifyInternalToken } from "@platform/shared/node";
import type { RequestHandler } from "express";

// Middleware router `/internal/v1` (ARCHITECTURE §9.3): Bearer JWT service dengan `aud = "api"`. Semua kegagalan
// (tanpa token, format salah, tanda tangan salah, kedaluwarsa, audience lain) → 401 yang sama, tanpa alasan.

declare global {
  namespace Express {
    interface Request {
      // Service pemanggil yang terverifikasi (hanya di router internal).
      service?: InternalClaims;
    }
  }
}

export function requireServiceToken(secret: string): RequestHandler {
  return async (req, _res, next) => {
    const header = req.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!token) throw new AppError("UNAUTHENTICATED");
    const result = await verifyInternalToken(secret, token, { audience: "api" });
    if (!result.ok) throw new AppError("UNAUTHENTICATED");
    req.service = result.value;
    next();
  };
}

/** Batasi rute internal ke service tertentu (setelah requireServiceToken); service lain → 403. */
export function allowServices(...services: InternalClaims["sub"][]): RequestHandler {
  return (req, _res, next) => {
    if (!req.service || !services.includes(req.service.sub)) {
      throw new AppError("FORBIDDEN", undefined, { allowed: services });
    }
    next();
  };
}
