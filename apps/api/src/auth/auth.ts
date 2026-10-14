import type { Db } from "@platform/db";
import { APP_PATHS, uuidv7 } from "@platform/shared";
import type { JobPayload } from "@platform/shared/contracts";
import { getContext, type Logger } from "@platform/shared/node";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { emailOTP } from "better-auth/plugins";
import type { Redis } from "ioredis";
import { recordAudit } from "../audit/audit.repository";
import type { QueueProducer } from "../queues/producer";
import { AUTH_TABLES, activeSessionTokens, insertConsents } from "./auth.repository";
import { afterAuthCommit, currentAuthTransaction, trackTransactions } from "./auth-transaction";
import { currentEmailChange } from "./email-change";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";
import { currentPasswordReset } from "./password-reset";
import { currentEvidence } from "./request-evidence";
import { currentSignIn, recordSignInFailure } from "./sign-in";
import { signUpConsents, signUpLocale } from "./sign-up";
import { currentSignUp } from "./sign-up-context";

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
// Verifikasi email (ACC-003): link & kode 6 digit berlaku 24 jam; kode gagal 3× → harus kirim ulang.
export const EMAIL_VERIFICATION_EXPIRES_IN = DAY;
// Token reset password berlaku 1 jam, sekali pakai (ACC-005).
export const RESET_PASSWORD_EXPIRES_IN = 3600;
const OTP_ALLOWED_ATTEMPTS = 3;
// Endpoint plugin emailOTP yang TIDAK dipakai (login/reset/ganti email via OTP, kirim OTP terpisah): hanya
// `/email-otp/verify-email` yang aktif; kode dikirim bersama link oleh `sendVerificationEmail`.
const DISABLED_OTP_PATHS = [
  "/email-otp/send-verification-otp",
  "/email-otp/check-verification-otp",
  "/sign-in/email-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
];
// Endpoint sesi bawaan BA membaca daftar sesi dari cache Redis (≤ 5 menit) → tidak lengkap. Pengganti berbasis
// Postgres: `/v1/account/sessions` (ACC-007). `/sign-out` dan `/revoke-sessions` (semua sesi) tetap aktif.
const DISABLED_SESSION_PATHS = ["/list-sessions", "/revoke-session", "/revoke-other-sessions"];
// `/update-user` BA membiarkan klien mengisi `image` dengan URL sembarang (pelacak/konten luar) dan melewati validasi
// kita → diganti `PATCH /v1/account/profile` (ACC-008).
const DISABLED_PROFILE_PATHS = ["/update-user"];

type EmailJobInput =
  JobPayload<"email"> extends infer Job ? (Job extends unknown ? Omit<Job, "requestId"> : never) : never;

export interface AuthConfig {
  secret: string;
  // URL publik auth, mis. http://app.localhost:3000/api/auth (env BETTER_AUTH_URL).
  publicAuthUrl: string;
  trustedOrigins: string[];
  secureCookies: boolean;
  // Login Google (ACC-002); tanpa kredensial provider tidak aktif. Redirect URI di Google Console:
  // `<publicAuthUrl>/callback/google`.
  // `redirectUri` bila beda dari `<publicAuthUrl>/callback/google` (lokal: Google menolak `*.localhost`).
  google?: { clientId: string; clientSecret: string; redirectUri?: string };
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

/**
 * Auto-login setelah registrasi baru (ACC-001). Better Auth hanya memberi respons generik untuk email yang sudah
 * terdaftar bila `autoSignIn: false`; sesi untuk user yang BENAR-BENAR baru dibuat di sini, sehingga body respons
 * kedua kasus identik (`token: null`) dan hanya cookie yang berbeda — keputusan owner 2026-10-13 (ditekan rate limit).
 */
const signUpAutoSignIn = {
  id: "platform-sign-up",
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === "/sign-up/email",
        handler: createAuthMiddleware(async (ctx) => {
          const signUp = currentSignUp();
          if (!signUp?.createdUserId) return;
          const user = await ctx.context.internalAdapter.findUserById(signUp.createdUserId);
          if (!user) return;
          const dontRememberMe = signUp.rememberMe === false;
          const session = await ctx.context.internalAdapter.createSession(user.id, dontRememberMe);
          await setSessionCookie(ctx, { session, user }, dontRememberMe);
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;

/**
 * Setelah `POST /sign-in/email` (ACC-004): berhasil → reset penghitung gagal + audit `auth.login`; kredensial salah →
 * tambah penghitung (Turnstile / kunci di signInGuard) + audit `auth.login_failed`. Tanpa password di log/audit.
 * Kegagalan Redis/audit dicatat tetapi tidak mengubah hasil login.
 */
function signInTracking(deps: { db: Db; redis: Redis; logger: Logger }) {
  const safely = async (operation: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (error) {
      deps.logger.error({ err: error, operation }, "pencatatan login gagal");
    }
  };
  return {
    id: "platform-sign-in",
    hooks: {
      after: [
        {
          matcher: (ctx) => ctx.path?.startsWith("/callback/") === true,
          // Login/registrasi OAuth berhasil (sesi baru) → audit `auth.login` (method = provider).
          handler: createAuthMiddleware(async (ctx) => {
            const session = ctx.context.newSession;
            if (!session) return;
            const evidence = currentEvidence();
            await safely("audit", () =>
              recordAudit(deps.db, {
                actorType: "user",
                actorId: session.user.id,
                action: "auth.login",
                targetType: "user",
                targetId: session.user.id,
                ip: evidence.ip ?? null,
                userAgent: evidence.userAgent ?? null,
                metadata: { method: ctx.params?.id ?? "oauth" },
              }),
            );
          }),
        },
        {
          matcher: (ctx) => ctx.path === "/sign-in/email",
          handler: createAuthMiddleware(async (ctx) => {
            const signIn = currentSignIn();
            if (!signIn) return;
            const evidence = { ip: signIn.ip ?? null, userAgent: signIn.userAgent ?? null };
            const session = ctx.context.newSession;
            if (session) {
              await safely("reset", () => deps.redis.del(signIn.failureKey));
              await safely("audit", () =>
                recordAudit(deps.db, {
                  actorType: "user",
                  actorId: session.user.id,
                  action: "auth.login",
                  targetType: "user",
                  targetId: session.user.id,
                  ...evidence,
                  metadata: { method: "email" },
                }),
              );
              return;
            }
            const returned = ctx.context.returned;
            if (returned instanceof APIError && returned.statusCode === 401) {
              await safely("count", () => recordSignInFailure(deps.redis, signIn.failureKey));
              await safely("audit", () =>
                recordAudit(deps.db, {
                  actorType: "user",
                  action: "auth.login_failed",
                  ...evidence,
                  metadata: { method: "email", email: signIn.email, reason: "invalid_credentials" },
                }),
              );
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}

/**
 * Setelah `POST /reset-password` berhasil (ACC-005): cabut semua sesi user KECUALI sesi request ini (bila milik user
 * yang sama) + audit `auth.password_reset`. Daftar sesi dari Postgres; `deleteSessions` menghapus DB & cache Redis.
 */
function passwordResetSessions(deps: { db: Db; logger: Logger; onPasswordChanged: (userId: string) => void }) {
  return {
    id: "platform-password-reset",
    hooks: {
      after: [
        {
          // Ganti password dari pengaturan (ACC-005/ACC-008): email "password diubah" + audit. Cabut sesi lain lewat
          // opsi `revokeOtherSessions` di body (BA, berbasis userId di Postgres).
          matcher: (ctx) => ctx.path === "/change-password",
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.context.returned instanceof APIError) return;
            const userId = ctx.context.session?.user.id;
            if (!userId) return;
            deps.onPasswordChanged(userId);
            const evidence = currentEvidence();
            try {
              await recordAudit(deps.db, {
                actorType: "user",
                actorId: userId,
                action: "auth.password_change",
                targetType: "user",
                targetId: userId,
                ip: evidence.ip ?? null,
                userAgent: evidence.userAgent ?? null,
                metadata: { revokeOtherSessions: ctx.body?.revokeOtherSessions === true },
              });
            } catch (error) {
              deps.logger.error({ err: error }, "audit ganti password gagal");
            }
          }),
        },
        {
          matcher: (ctx) => ctx.path === "/reset-password",
          handler: createAuthMiddleware(async (ctx) => {
            const reset = currentPasswordReset();
            if (!reset?.userId) return;
            const userId = reset.userId;
            const current = await getSessionFromCtx(ctx);
            const keepToken = current?.user.id === userId ? current.session.token : undefined;
            const tokens = await activeSessionTokens(deps.db, userId, keepToken);
            if (tokens.length > 0) await ctx.context.internalAdapter.deleteSessions(tokens);
            try {
              await recordAudit(deps.db, {
                actorType: "user",
                actorId: userId,
                action: "auth.password_reset",
                targetType: "user",
                targetId: userId,
                ip: reset.ip ?? null,
                userAgent: reset.userAgent ?? null,
                metadata: { revokedSessions: tokens.length },
              });
            } catch (error) {
              deps.logger.error({ err: error }, "audit reset password gagal");
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}

export function createAuth(deps: {
  db: Db;
  redis: Redis;
  logger: Logger;
  config: AuthConfig;
  // Email "Anda sudah punya akun" untuk registrasi dengan email terdaftar (ACC-001).
  queues?: QueueProducer;
}) {
  const { config, logger } = deps;
  /**
   * Antrekan email setelah transaksi auth commit (rollback → tidak terkirim) dan tanpa ditunggu: waktu respons tidak
   * boleh bergantung pada Redis (enumerasi email, ACC-001) dan kegagalan enqueue tidak menggagalkan request.
   */
  const enqueueEmail = (job: EmailJobInput) =>
    afterAuthCommit(() => {
      deps.queues
        ?.enqueue("email", { requestId: getContext()?.requestId ?? uuidv7(), ...job })
        .catch((error: unknown) => logger.warn({ err: error, template: job.template }, "enqueue email gagal"));
    });
  // Diisi setelah instance dibuat (callback BA butuh API plugin emailOTP milik instance yang sama).
  let createVerificationCode: ((email: string) => Promise<string>) | undefined;
  const publicUrl = new URL(config.publicAuthUrl);
  const auth = betterAuth({
    secret: config.secret,
    // Link (verifikasi, reset, OAuth callback) = baseURL + basePath = URL publik `/api/auth`.
    baseURL: `${publicUrl.origin}${publicUrl.pathname.replace(/\/auth\/?$/, "")}`,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: config.trustedOrigins,
    // Error alur redirect (mis. OAuth `account_not_linked`) → halaman login web dengan `?error=` (ACC-002).
    onAPIError: { errorURL: `${publicUrl.origin}${APP_PATHS.login}` },
    database: drizzleAdapter(trackTransactions(deps.db), {
      provider: "pg",
      schema: AUTH_TABLES,
      // Registrasi (user + akun + consent) dalam satu transaksi.
      transaction: true,
    }),
    secondaryStorage: redisSessionCache(deps.redis, deps.logger),
    emailAndPassword: {
      enabled: true,
      // Verifikasi email wajib diaktifkan bersama pengiriman email (T1.5.3).
      requireEmailVerification: false,
      // Respons generik untuk email terdaftar; auto-login user baru lewat plugin `platform-sign-up`.
      autoSignIn: false,
      // Kebijakan lengkap (daftar password umum) di signUpGuard; batas ini cadangan untuk endpoint BA lain.
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      resetPasswordTokenExpiresIn: RESET_PASSWORD_EXPIRES_IN,
      // Pencabutan sesi diatur plugin `platform-password-reset` (sesi saat ini dipertahankan).
      revokeSessionsOnPasswordReset: false,
      sendResetPassword: async ({ user, token }) => {
        // Link publik → BA memvalidasi token lalu mengarahkan ke form password baru di web.
        const resetUrl = `${config.publicAuthUrl.replace(/\/$/, "")}/reset-password/${encodeURIComponent(token)}?callbackURL=${encodeURIComponent(APP_PATHS.resetPassword)}`;
        enqueueEmail({ template: "auth.password_reset", userId: user.id, resetUrl });
      },
      onPasswordReset: async ({ user }) => {
        const reset = currentPasswordReset();
        if (reset) reset.userId = user.id;
        enqueueEmail({ template: "auth.password_changed", userId: user.id });
      },
      onExistingUserSignUp: async ({ user }) => {
        enqueueEmail({ template: "auth.account_exists", userId: user.id });
      },
    },
    emailVerification: {
      // Belum terverifikasi tetap boleh login & mengedit; publish/undang/beli/AI diblokir (ACC-003, ACC-256).
      sendOnSignUp: true,
      expiresIn: EMAIL_VERIFICATION_EXPIRES_IN,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, token }) => {
        // Link publik (lewat proxy web); setelah diproses BA mengarahkan ke halaman hasil di web.
        const verifyUrl = `${config.publicAuthUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}&callbackURL=${encodeURIComponent(APP_PATHS.verifyEmail)}`;
        const emailChange = currentEmailChange();
        if (emailChange) {
          // Ganti email: ke alamat BARU, hanya tautan (kode OTP terikat alamat tersimpan).
          enqueueEmail({ template: "auth.verify_email", userId: user.id, verifyUrl, email: emailChange.newEmail });
          return;
        }
        if (!createVerificationCode) throw new Error("auth belum siap: createVerificationCode kosong");
        const code = await createVerificationCode(user.email);
        enqueueEmail({ template: "auth.verify_email", userId: user.id, verifyUrl, code });
      },
    },
    user: {
      // Ganti email (ACC-008): verifikasi ke alamat baru; email lama berlaku sampai diverifikasi. Re-auth di
      // changeEmailGuard (auth.routes.ts).
      changeEmail: { enabled: true },
      // Kolom platform yang diisi saat registrasi; tidak bisa diisi dari body dan tidak ikut respons BA
      // (respons email baru vs terdaftar harus berbentuk sama).
      additionalFields: {
        locale: { type: "string", required: false, input: false, returned: false },
        timezone: { type: "string", required: false, input: false, returned: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            const signUp = currentSignUp();
            if (!signUp) {
              // Registrasi lewat OAuth (Google): bahasa dari browser yang membuka callback; zona waktu default kolom.
              const acceptLanguage = context?.headers?.get("accept-language");
              return acceptLanguage === undefined
                ? undefined
                : { data: { ...user, locale: signUpLocale(acceptLanguage ?? undefined) } };
            }
            return {
              data: { ...user, locale: signUp.locale, ...(signUp.timezone ? { timezone: signUp.timezone } : {}) },
            };
          },
          // Setelah commit: user benar-benar ada → boleh login otomatis.
          after: async (user) => {
            const signUp = currentSignUp();
            if (signUp) signUp.createdUserId = user.id;
          },
        },
      },
      session: {
        create: {
          // Lokasi perkiraan dari header Cloudflare (hanya ada di belakang Cloudflare; lokal → null) — ACC-007.
          before: async (session, context) => {
            const country = context?.headers?.get("cf-ipcountry") ?? undefined;
            const city = context?.headers?.get("cf-ipcity") ?? undefined;
            const geo = country || city ? { ...(country ? { country } : {}), ...(city ? { city } : {}) } : null;
            return { data: { ...session, geo, lastActiveAt: new Date() } };
          },
        },
      },
      account: {
        create: {
          // Berjalan di transaksi registrasi tepat setelah insert user → consent ikut commit/rollback bersama user.
          before: async (account) => {
            const signUp = currentSignUp();
            if (!signUp || account.providerId !== "credential") return;
            await insertConsents(currentAuthTransaction(), signUpConsents(account.userId, signUp));
          },
        },
      },
    },
    plugins: [
      signUpAutoSignIn,
      signInTracking({ db: deps.db, redis: deps.redis, logger }),
      passwordResetSessions({
        db: deps.db,
        logger,
        onPasswordChanged: (userId) => enqueueEmail({ template: "auth.password_changed", userId }),
      }),
      emailOTP({
        expiresIn: EMAIL_VERIFICATION_EXPIRES_IN,
        allowedAttempts: OTP_ALLOWED_ATTEMPTS,
        storeOTP: "hashed",
        // Wajib diisi plugin, tetapi endpoint pengirimnya dimatikan (DISABLED_OTP_PATHS).
        sendVerificationOTP: async () => {
          throw new Error("kirim OTP terpisah tidak dipakai; kode dikirim bersama link verifikasi");
        },
      }),
    ],
    disabledPaths: [...DISABLED_OTP_PATHS, ...DISABLED_SESSION_PATHS, ...DISABLED_PROFILE_PATHS],
    // Rate limit memakai limiter API sendiri (Redis, 429 + Retry-After, ACC-255) di auth.routes.ts.
    rateLimit: { enabled: false },
    session: {
      // Kolom platform di `sessions` (ACC-007), diisi hook; tidak bisa diisi klien & tidak ikut respons BA.
      additionalFields: {
        geo: { type: "json", required: false, input: false, returned: false },
        lastActiveAt: { type: "date", required: false, input: false, returned: false },
      },
      expiresIn: SESSION_EXPIRES_IN,
      updateAge: DAY,
      // Postgres sumber kebenaran (daftar & cabut sesi, ACC-007); Redis hanya cache.
      storeSessionInDatabase: true,
    },
    ...(config.google
      ? {
          socialProviders: {
            google: {
              clientId: config.google.clientId,
              clientSecret: config.google.clientSecret,
              // Eksplisit: default BA membentuknya dari baseURL tanpa basePath (`/api/callback/google`, salah).
              redirectURI: config.google.redirectUri ?? `${config.publicAuthUrl.replace(/\/$/, "")}/callback/google`,
              // Default scope BA = openid email profile (ACC-002); pilih akun tiap kali (PC bersama).
              prompt: "select_account" as const,
            },
          },
        }
      : {}),
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        // ACC-002: tautkan Google ke akun email yang sama HANYA bila email akun lokal sudah terverifikasi DAN Google
        // menyatakan emailnya terverifikasi (Google sengaja tidak dijadikan trusted provider) — cegah account takeover.
        requireLocalEmailVerified: true,
        trustedProviders: [],
        // Memutus tautan hanya bila masih ada metode login lain (password).
        allowUnlinkingAll: false,
      },
    },
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
    // Log Better Auth ke logger terstruktur (requestId ikut lewat mixin). Mulai `warn`: log info BA memuat email.
    logger: {
      level: "warn",
      log: (level, message, ...args) => {
        const fields = args.length > 0 ? { args } : {};
        if (level === "error") logger.error(fields, `better-auth: ${message}`);
        else if (level === "warn") logger.warn(fields, `better-auth: ${message}`);
        else logger.debug(fields, `better-auth: ${message}`);
      },
    },
  });
  createVerificationCode = (email) => auth.api.createVerificationOTP({ body: { email, type: "email-verification" } });
  return auth;
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
