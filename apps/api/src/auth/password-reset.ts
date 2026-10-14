import { AsyncLocalStorage } from "node:async_hooks";
import { isIP } from "node:net";
import { AppError } from "@platform/shared";
import type { RequestHandler } from "express";
import { checkPassword } from "./password-policy";

// Reset & ganti password (ACC-005): kebijakan password yang sama dengan registrasi berlaku untuk password baru
// (sebelum Better Auth), dan konteks request dibawa ke hook BA (user yang direset → cabut sesi lain, audit).

export interface PasswordResetContext {
  ip?: string;
  userAgent?: string;
  // Diisi `onPasswordReset` Better Auth setelah password diganti.
  userId?: string;
}

const storage = new AsyncLocalStorage<PasswordResetContext>();

export function currentPasswordReset(): PasswordResetContext | undefined {
  return storage.getStore();
}

/** Tolak `newPassword` yang melanggar kebijakan → 422 WEAK_PASSWORD (pesan i18n), lalu buka konteks reset. */
export function newPasswordGuard(): RequestHandler {
  return (req, _res, next) => {
    const newPassword: unknown = (req.body as { newPassword?: unknown } | undefined)?.newPassword;
    // Bukan string → biar Better Auth yang menolak dengan validasinya.
    if (typeof newPassword === "string") {
      const problem = checkPassword(newPassword);
      if (problem) throw new AppError("WEAK_PASSWORD", undefined, { reason: problem });
    }
    const userAgent = req.get("user-agent");
    storage.run({ ...(req.ip && isIP(req.ip) ? { ip: req.ip } : {}), ...(userAgent ? { userAgent } : {}) }, () =>
      next(),
    );
  };
}
