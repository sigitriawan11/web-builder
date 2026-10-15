import { type NextRequest, NextResponse } from "next/server";
import { editorRewriteUrl, loadWebEnv } from "./config/routing";
import { decideProxy, LOCALE_HEADER, REQUEST_ID_HEADER } from "./lib/proxy/decide";
import { createNonce, type SecurityEnv, securityHeaders } from "./lib/security/headers";

// Proxy Next.js 16 (pengganti `middleware.ts`; ARCHITECTURE §3.4, §5.1): host routing, gate cookie sesi, locale,
// `x-request-id`, header keamanan (PUB-211). Berjalan SEBELUM rewrites `beforeFiles` → header request yang diset
// ikut ke `/api` & `/editor`, dan header respons ikut pada respons yang di-rewrite.
const env = loadWebEnv();
const origin = (url: string) => new URL(url).origin;
const editorPort = new URL(env.EDITOR_ORIGIN).port || "80";
const security: SecurityEnv = {
  isDev: process.env.NODE_ENV === "development",
  isProduction: env.APP_ENV === "production",
  connectOrigins: [
    origin(env.PUBLIC_API_URL),
    origin(env.PUBLIC_REALTIME_URL),
    ...(env.NEXT_PUBLIC_SENTRY_DSN ? [origin(env.NEXT_PUBLIC_SENTRY_DSN)] : []),
  ],
  imageOrigins: [origin(env.PUBLIC_ASSETS_URL)],
  editorDevSocket: `ws://${new URL(env.PUBLIC_APP_URL).hostname}:${editorPort}`,
};

export function proxy(request: NextRequest): NextResponse {
  const decision = decideProxy({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    host: request.headers.get("host") ?? request.nextUrl.host,
    cookies: new Map(request.cookies.getAll().map((cookie) => [cookie.name, cookie.value])),
    requestId: request.headers.get(REQUEST_ID_HEADER),
    acceptLanguage: request.headers.get("accept-language"),
    appUrl: env.PUBLIC_APP_URL,
    marketingUrl: env.PUBLIC_MARKETING_URL,
    newRequestId: () => crypto.randomUUID(),
  });

  if (decision.type === "redirect") {
    const response = NextResponse.redirect(decision.location, decision.status);
    response.headers.set(REQUEST_ID_HEADER, decision.requestId);
    return response;
  }
  const nonce = decision.surface === "app" ? createNonce() : undefined;
  const responseHeaders = securityHeaders(decision.surface, security, nonce);
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, decision.requestId);
  headers.set(LOCALE_HEADER, decision.locale);
  if (nonce) {
    // Next membaca nonce dari CSP di header REQUEST lalu memasangnya pada script framework (render dinamis).
    headers.set("x-nonce", nonce);
    headers.set("content-security-policy", responseHeaders["content-security-policy"] ?? "");
  }
  const response =
    decision.surface === "editor"
      ? // Rewrite editor dilakukan di sini (bukan next.config) agar header keamanan ikut pada respons origin editor.
        NextResponse.rewrite(editorRewriteUrl(env, request.nextUrl.pathname, request.nextUrl.search), {
          request: { headers },
        })
      : NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID_HEADER, decision.requestId);
  for (const [name, value] of Object.entries(responseHeaders)) response.headers.set(name, value);
  return response;
}

export const config = {
  // Aset build Next & file statis akar tidak perlu proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
