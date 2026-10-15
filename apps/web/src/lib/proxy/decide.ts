import { LOCALES, type Locale, localeFromAcceptLanguage } from "@platform/i18n";
import type { Surface } from "../security/headers";

// Keputusan proxy Next.js (ARCHITECTURE §3.4, §5.1) sebagai fungsi murni — `src/proxy.ts` hanya menerjemahkannya
// ke NextResponse. Urutan: request id → host routing (apex vs `app.`) → gate cookie sesi → locale.

/** Cookie sesi Better Auth (`cookiePrefix: "platform"`; prefix `__Secure-` saat cookie secure). Hanya KEBERADAAN
 *  yang dicek di sini — validasi sesi sesungguhnya di api (`GET /api/v1/me`). */
export const SESSION_COOKIES = ["platform.session_token", "__Secure-platform.session_token"] as const;
// Spec 08 §13: bahasa tamu disimpan di cookie `NEXT_LOCALE` (user login: `users.locale`, disinkronkan ke cookie).
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const REQUEST_ID_HEADER = "x-request-id";
export const LOCALE_HEADER = "x-locale";

// Path milik host `app.` (selain itu milik marketing).
const APP_PREFIXES = [
  "/api",
  "/editor",
  "/sites",
  "/account",
  "/billing",
  "/admin",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  // Katalog komponen dev (T1.15.4; 404 di production).
  "/dev",
];
// Butuh cookie sesi; tanpa cookie → `/login?next=…`.
const PROTECTED_PREFIXES = ["/sites", "/account", "/billing", "/admin", "/editor"];

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

const matches = (path: string, prefixes: readonly string[]) =>
  prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));

const normalizeHost = (host: string) => host.trim().toLowerCase().replace(/\.$/, "").replace(/\.:/, ":");

export interface ProxyInput {
  // Path + query apa adanya dari URL request.
  pathname: string;
  search: string;
  host: string;
  cookies: ReadonlyMap<string, string>;
  requestId: string | null;
  acceptLanguage: string | null;
  appUrl: string;
  marketingUrl: string;
  newRequestId: () => string;
}

export type ProxyDecision =
  | { type: "redirect"; location: string; status: 307; requestId: string }
  | { type: "next"; requestId: string; locale: Locale; surface: Surface };

export function decideProxy(input: ProxyInput): ProxyDecision {
  const requestId =
    input.requestId && REQUEST_ID_PATTERN.test(input.requestId) ? input.requestId : input.newRequestId();
  const host = normalizeHost(input.host);
  const app = new URL(input.appUrl);
  const marketingHost = normalizeHost(new URL(input.marketingUrl).host);
  const isAppHost = host === normalizeHost(app.host);
  const path = input.pathname;
  const redirect = (location: string): ProxyDecision => ({ type: "redirect", location, status: 307, requestId });

  // Path aplikasi di host marketing → pindah ke `app.` (307 mempertahankan method, aman untuk /api).
  if (host === marketingHost && !isAppHost && matches(path, APP_PREFIXES)) {
    return redirect(`${app.origin}${path}${input.search}`);
  }
  if (isAppHost && path === "/") return redirect(`${app.origin}/sites`);

  // Hanya keberadaan cookie: tanpa cookie pasti belum login; cookie kedaluwarsa ditangani api (401 → login).
  const hasSession = SESSION_COOKIES.some((name) => Boolean(input.cookies.get(name)));
  if (isAppHost && !hasSession && matches(path, PROTECTED_PREFIXES)) {
    const next = encodeURIComponent(`${path}${input.search}`);
    return redirect(`${app.origin}/login?next=${next}`);
  }

  const cookieLocale = input.cookies.get(LOCALE_COOKIE);
  const locale =
    cookieLocale && (LOCALES as readonly string[]).includes(cookieLocale)
      ? (cookieLocale as Locale)
      : localeFromAcceptLanguage(input.acceptLanguage);
  // Permukaan menentukan header keamanan (PUB-211); host tak dikenal diperlakukan sebagai marketing (paling longgar
  // yang tetap aman: tanpa sesi).
  const surface: Surface = matches(path, ["/api"])
    ? "api"
    : isAppHost && matches(path, ["/editor"])
      ? "editor"
      : isAppHost
        ? "app"
        : "marketing";
  return { type: "next", requestId, locale, surface };
}
