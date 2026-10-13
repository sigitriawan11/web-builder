import { AppError } from "@platform/shared";
import { updateContext } from "@platform/shared/node";
import { fromNodeHeaders } from "better-auth/node";
import type { RequestHandler } from "express";
import type { Auth } from "../auth/auth";

// Middleware 6 & 7 (ARCHITECTURE §5.3). Satu-satunya tempat yang membaca sesi Better Auth: kode lain memakai
// `req.ctx.user`, sehingga Better Auth bisa diganti tanpa menyentuh modul fitur (ARCHITECTURE §9.1).

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

/** Isi `req.ctx.user` (atau `null`) dari cookie sesi; perpanjangan sesi rolling diteruskan sebagai Set-Cookie. */
export function authSession(auth: Auth): RequestHandler {
  return async (req, res, next) => {
    const { headers, response } = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      returnHeaders: true,
    });
    for (const cookie of headers.getSetCookie()) res.append("set-cookie", cookie);
    if (response) {
      const { id, email, name, emailVerified } = response.user;
      req.ctx.user = { id, email, name, emailVerified };
      updateContext({ userId: id });
    } else {
      req.ctx.user = null;
    }
    next();
  };
}

/** Wajib login; tanpa sesi → 401 UNAUTHENTICATED. */
export function requireAuth(): RequestHandler {
  return (req, _res, next) => {
    if (!req.ctx.user) throw new AppError("UNAUTHENTICATED");
    next();
  };
}
