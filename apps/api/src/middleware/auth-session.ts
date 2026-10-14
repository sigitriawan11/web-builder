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

// `last_active_at` ditulis paling sering sekali per 5 menit per sesi (ACC-007); cache proses mencegah UPDATE tiap
// request. Dibatasi ukurannya agar tidak tumbuh tanpa batas.
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60_000;
const TOUCH_CACHE_MAX = 10_000;

/**
 * Isi `req.ctx.user` & `req.ctx.session` (atau `null`) dari cookie sesi; perpanjangan sesi rolling diteruskan sebagai
 * Set-Cookie. `onActive` dipanggil untuk menandai sesi aktif (tanpa menunggu; error dicatat pemanggil).
 */
export function authSession(
  auth: Auth,
  options: { onActive?: (sessionId: string, staleBefore: Date) => void } = {},
): RequestHandler {
  const lastTouched = new Map<string, number>();
  const touch = (sessionId: string) => {
    if (!options.onActive) return;
    const now = Date.now();
    if (now - (lastTouched.get(sessionId) ?? 0) < SESSION_TOUCH_INTERVAL_MS) return;
    if (lastTouched.size >= TOUCH_CACHE_MAX) lastTouched.clear();
    lastTouched.set(sessionId, now);
    options.onActive(sessionId, new Date(now - SESSION_TOUCH_INTERVAL_MS));
  };
  return async (req, res, next) => {
    const { headers, response } = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      returnHeaders: true,
    });
    for (const cookie of headers.getSetCookie()) res.append("set-cookie", cookie);
    if (response) {
      const { id, email, name, emailVerified } = response.user;
      req.ctx.user = { id, email, name, emailVerified };
      req.ctx.session = { id: response.session.id };
      updateContext({ userId: id });
      touch(response.session.id);
    } else {
      req.ctx.user = null;
      req.ctx.session = null;
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
