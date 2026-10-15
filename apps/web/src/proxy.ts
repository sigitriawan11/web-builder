import { type NextRequest, NextResponse } from "next/server";
import { loadWebEnv } from "./config/routing";
import { decideProxy, LOCALE_HEADER, REQUEST_ID_HEADER } from "./lib/proxy/decide";

// Proxy Next.js 16 (pengganti `middleware.ts`; ARCHITECTURE §3.4, §5.1): host routing, gate cookie sesi, locale,
// `x-request-id`. Berjalan SEBELUM rewrites `beforeFiles` → header request yang diset ikut ke `/api` & `/editor`.
const env = loadWebEnv();

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
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, decision.requestId);
  headers.set(LOCALE_HEADER, decision.locale);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID_HEADER, decision.requestId);
  return response;
}

export const config = {
  // Aset build Next & file statis akar tidak perlu proxy.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
