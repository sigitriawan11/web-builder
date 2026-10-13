import type { Db } from "@platform/db";
import { uuidv7 } from "@platform/shared";
import type { Logger } from "@platform/shared/node";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Redis } from "ioredis";
import { AUTH_TABLES } from "./auth.repository";

// Auth akun platform (ARCHITECTURE §9.1, spec 08 ACC-004). API me-mount handler di `/auth/*`; browser mengaksesnya
// sebagai `app.<domain>/api/auth/*` lewat rewrite Next.js (prefix `/api` dibuang, sama seperti `/api/v1/*`).
// Seluruh kode lain membaca user lewat `req.ctx` (middleware adapter, T1.5.4), bukan API Better Auth langsung.

export const AUTH_BASE_PATH = "/auth";
const DAY = 86_400;
// Sesi rolling 30 hari ("Ingat saya", ACC-004); diperbarui paling sering sekali sehari.
export const SESSION_EXPIRES_IN = 30 * DAY;
// Cache sesi di Redis dibatasi 5 menit: bila pencabutan sesi terjadi saat Redis mati, salinan cache yang basi
// paling lama berlaku 5 menit (sumber kebenaran tetap Postgres).
export const SESSION_CACHE_TTL_SECONDS = 300;
const REDIS_PREFIX = "auth:";

export interface AuthConfig {
  secret: string;
  // URL publik auth, mis. http://app.localhost:3000/api/auth (env BETTER_AUTH_URL).
  publicAuthUrl: string;
  trustedOrigins: string[];
  secureCookies: boolean;
}

/**
 * Cache Redis untuk sesi (ARCHITECTURE §9.1). Error Redis = "tidak ada di cache": Better Auth lalu membaca sesi dari
 * Postgres (`storeSessionInDatabase`), sehingga login tetap jalan saat Redis mati.
 */
function redisSessionCache(redis: Redis, logger: Logger) {
  const warn = (operation: string, error: unknown) => logger.warn({ err: error, operation }, "cache sesi Redis gagal");
  return {
    get: async (key: string) => {
      try {
        return await redis.get(REDIS_PREFIX + key);
      } catch (error) {
        warn("get", error);
        return null;
      }
    },
    set: async (key: string, value: string, ttl?: number) => {
      try {
        await redis.set(
          REDIS_PREFIX + key,
          value,
          "EX",
          Math.min(ttl ?? SESSION_CACHE_TTL_SECONDS, SESSION_CACHE_TTL_SECONDS),
        );
      } catch (error) {
        warn("set", error);
      }
    },
    delete: async (key: string) => {
      try {
        await redis.del(REDIS_PREFIX + key);
      } catch (error) {
        warn("delete", error);
      }
    },
    // Token sekali pakai (mis. verifikasi): ambil & hapus atomik.
    getAndDelete: async (key: string) => {
      try {
        return await redis.getdel(REDIS_PREFIX + key);
      } catch (error) {
        warn("getAndDelete", error);
        return null;
      }
    },
    // Penghitung (rate limit internal Better Auth); Redis mati → 0 (rate limit API sendiri tetap punya cadangan).
    increment: async (key: string, ttl?: number) => {
      try {
        const value = await redis.incr(REDIS_PREFIX + key);
        if (value === 1 && ttl) await redis.expire(REDIS_PREFIX + key, ttl);
        return value;
      } catch (error) {
        warn("increment", error);
        return 0;
      }
    },
  };
}

export function createAuth(deps: { db: Db; redis: Redis; logger: Logger; config: AuthConfig }) {
  const { config } = deps;
  const publicUrl = new URL(config.publicAuthUrl);
  return betterAuth({
    secret: config.secret,
    // Link (verifikasi, reset, OAuth callback) = baseURL + basePath = URL publik `/api/auth`.
    baseURL: `${publicUrl.origin}${publicUrl.pathname.replace(/\/auth\/?$/, "")}`,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: config.trustedOrigins,
    database: drizzleAdapter(deps.db, {
      provider: "pg",
      schema: AUTH_TABLES,
    }),
    secondaryStorage: redisSessionCache(deps.redis, deps.logger),
    emailAndPassword: {
      enabled: true,
      // Verifikasi email wajib diaktifkan bersama pengiriman email (T1.5.3).
      requireEmailVerification: false,
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN,
      updateAge: DAY,
      // Postgres sumber kebenaran (daftar & cabut sesi, ACC-007); Redis hanya cache.
      storeSessionInDatabase: true,
    },
    account: { encryptOAuthTokens: true },
    advanced: {
      // Eksplisit: default Better Auth mematikan origin check bila NODE_ENV=test, padahal test harus menguji
      // perilaku produksi (CSRF, ARCHITECTURE §9.1).
      disableOriginCheck: false,
      database: { generateId: () => uuidv7() },
      cookiePrefix: "platform",
      useSecureCookies: config.secureCookies,
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * Handler Better Auth untuk path API `/auth/*`. URL publik (proxy web) adalah `/api/auth/*` dan Better Auth
 * mencocokkan route dengan pathname `baseURL` publik itu (dipakai juga untuk link email & callback OAuth),
 * jadi path API ditulis ulang ke path publik sebelum diteruskan.
 */
export function authRequestHandler(auth: Auth): (request: Request) => Promise<Response> {
  return async (request) => {
    const publicPath = new URL((await auth.$context).baseURL).pathname.replace(/\/$/, "");
    const url = new URL(request.url);
    if (url.pathname.startsWith(`${AUTH_BASE_PATH}/`) || url.pathname === AUTH_BASE_PATH) {
      url.pathname = publicPath + url.pathname.slice(AUTH_BASE_PATH.length);
    }
    return auth.handler(new Request(url, request));
  };
}
