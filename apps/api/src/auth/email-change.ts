import { AsyncLocalStorage } from "node:async_hooks";
import type { Db } from "@platform/db";
import { AppError } from "@platform/shared";
import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";
import { z } from "zod";
import type { Auth } from "./auth";
import { hasCredentialAccount } from "./auth.repository";

// Ganti email (ACC-008): wajib re-auth sebelum Better Auth mengirim verifikasi ke alamat BARU — password bila
// akun punya password, selain itu (Google-only) login yang masih baru. Email lama tetap aktif sampai alamat baru
// diverifikasi (bawaan BA). Alamat baru dibawa ke callback `sendVerificationEmail` lewat AsyncLocalStorage.

export const FRESH_LOGIN_MAX_AGE_MS = 10 * 60_000;

const ChangeEmailBodySchema = z.object({
  newEmail: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: z.string().max(1024).optional(),
});

export interface EmailChangeContext {
  newEmail: string;
}

const storage = new AsyncLocalStorage<EmailChangeContext>();

export function currentEmailChange(): EmailChangeContext | undefined {
  return storage.getStore();
}

export function changeEmailGuard(deps: { auth: Auth; db: Db }): RequestHandler {
  return async (req, _res, next) => {
    const headers = fromNodeHeaders(req.headers);
    const session = await deps.auth.api.getSession({ headers });
    // Tanpa sesi: biar Better Auth yang menolak (401).
    if (!session) return next();
    const parsed = ChangeEmailBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_FAILED", undefined, {
        issues: parsed.error.issues.map((issue) => ({
          location: "body",
          path: issue.path.map(String).join("."),
          code: issue.code,
          message: issue.message,
        })),
      });
    }
    const { newEmail, password } = parsed.data;

    if (await hasCredentialAccount(deps.db, session.user.id)) {
      if (!password) throw new AppError("REAUTH_REQUIRED", undefined, { method: "password" });
      try {
        await deps.auth.api.verifyPassword({ body: { password }, headers });
      } catch {
        throw new AppError("REAUTH_REQUIRED", undefined, { method: "password" });
      }
    } else if (Date.now() - session.session.createdAt.getTime() > FRESH_LOGIN_MAX_AGE_MS) {
      throw new AppError("REAUTH_REQUIRED", undefined, { method: "fresh_login" });
    }

    // Password tidak diteruskan ke Better Auth; link verifikasi kembali ke halaman hasil di web.
    req.body = { newEmail };
    storage.run({ newEmail }, () => next());
  };
}
