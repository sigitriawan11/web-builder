import { isIP } from "node:net";
import { type Locale, localeFromAcceptLanguage } from "@platform/i18n";
import { AppError, LEGAL_VERSIONS } from "@platform/shared";
import type { RequestHandler } from "express";
import type { NewConsent } from "./auth.repository";
import { checkPassword } from "./password-policy";
import { type SignUpBody, SignUpBodySchema } from "./sign-up.schema";
import { runWithSignUpContext, type SignUpContext } from "./sign-up-context";

// Registrasi email + password (ACC-001): validasi & kebijakan password di boundary Express (error memakai envelope
// API + i18n), lalu body ternormalisasi diteruskan ke Better Auth bersama konteks registrasi.

/** Bahasa UI awal (ACC-001): `id` bila browser memilih bahasa Indonesia, selain itu `en`. */
export function signUpLocale(acceptLanguage: string | undefined): Locale {
  const prefersIndonesian =
    localeFromAcceptLanguage(acceptLanguage) === "id" && /(?:^|,)\s*id(?:[-;,\s]|$)/i.test(acceptLanguage ?? "");
  return prefersIndonesian ? "id" : "en";
}

/** Baris `consents` registrasi: S&K dan privasi (wajib), marketing (pilihan user, dicatat juga bila menolak). */
export function signUpConsents(userId: string, context: SignUpContext): NewConsent[] {
  const evidence = { userId, ip: context.ip ?? null, userAgent: context.userAgent ?? null };
  return [
    { ...evidence, type: "terms", version: LEGAL_VERSIONS.terms, granted: true },
    { ...evidence, type: "privacy", version: LEGAL_VERSIONS.privacy, granted: true },
    { ...evidence, type: "marketing", version: LEGAL_VERSIONS.marketing, granted: context.marketingOptIn },
  ];
}

function toBetterAuthBody(body: SignUpBody) {
  return {
    name: body.name,
    email: body.email,
    password: body.password,
    ...(body.callbackURL === undefined ? {} : { callbackURL: body.callbackURL }),
    ...(body.rememberMe === undefined ? {} : { rememberMe: body.rememberMe }),
  };
}

/** Middleware `POST /auth/sign-up/email` (setelah `express.json`), sebelum handler Better Auth. */
export function signUpGuard(): RequestHandler {
  return (req, _res, next) => {
    const parsed = SignUpBodySchema.safeParse(req.body);
    if (!parsed.success) {
      // Tanpa nilai input (password) di details.
      const issues = parsed.error.issues.map((issue) => ({
        location: "body",
        path: issue.path.map(String).join("."),
        code: issue.code,
        message: issue.message,
      }));
      throw new AppError("VALIDATION_FAILED", undefined, { issues });
    }
    const body = parsed.data;
    const problem = checkPassword(body.password);
    if (problem) throw new AppError("WEAK_PASSWORD", undefined, { reason: problem });

    // Better Auth membaca `req.body` yang sudah di-parse (stream sudah habis); panjang body lama tidak berlaku lagi.
    req.body = toBetterAuthBody(body);
    delete req.headers["content-length"];
    const userAgent = req.get("user-agent");
    runWithSignUpContext(
      {
        locale: signUpLocale(req.get("accept-language")),
        marketingOptIn: body.marketingOptIn,
        ...(body.timezone === undefined ? {} : { timezone: body.timezone }),
        ...(body.rememberMe === undefined ? {} : { rememberMe: body.rememberMe }),
        // Kolom `inet`: IP tak valid (header proxy rusak) disimpan null, bukan menggagalkan registrasi.
        ...(req.ip && isIP(req.ip) ? { ip: req.ip } : {}),
        ...(userAgent === undefined ? {} : { userAgent }),
      },
      () => next(),
    );
  };
}
