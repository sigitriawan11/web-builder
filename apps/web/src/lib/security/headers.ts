// Header keamanan platform (PUB-211, ARCHITECTURE §9.7) per "permukaan" yang dilayani apps/web:
// - `app`: halaman Next di `app.` (dinamis) — CSP dengan nonce per request + `strict-dynamic`.
// - `editor`: SPA Vite statis di `/editor/*` (lewat rewrite) — tidak bisa diberi nonce → `script-src 'self'`.
// - `marketing`: host apex (SSG/ISR, ARCHITECTURE §5.1) — nonce memaksa render dinamis, jadi tanpa nonce.
// - `api`: tidak disentuh — header dipasang apps/api (helmet).
// Semua: tidak boleh di-iframe (`frame-ancestors 'none'` + `X-Frame-Options: DENY`).
// `style-src` memakai 'unsafe-inline' (tanpa nonce): Radix/canvas memakai atribut `style`, yang diblokir bila ada
// nonce di `style-src` (CSP3 mengabaikan 'unsafe-inline' saat nonce hadir).

export type Surface = "app" | "editor" | "marketing" | "api";

// ED-116: font situs di-lazy-load dari Fontsource (woff2) lewat CDN jsDelivr (sementara; dicerminkan ke CDN
// platform saat katalog font dibuat — spec 07). Diizinkan di `font-src` agar FontFace tidak diblokir CSP.
export const FONT_CDN_ORIGIN = "https://cdn.jsdelivr.net";

export interface SecurityEnv {
  isDev: boolean;
  isProduction: boolean;
  // Origin yang boleh dihubungi browser (selain 'self'): api. (SSE), realtime (WS), Sentry.
  connectOrigins: readonly string[];
  // Origin gambar (aset user).
  imageOrigins: readonly string[];
  // Dev: WebSocket HMR Vite (klien tersambung langsung ke port Vite, T1.14.1).
  editorDevSocket?: string;
}

const directives = (entries: ReadonlyArray<readonly [string, readonly string[]]>) =>
  entries.map(([name, values]) => [name, ...values].join(" ")).join("; ");

export function buildCsp(surface: Exclude<Surface, "api">, env: SecurityEnv, nonce?: string): string {
  const devEval = env.isDev ? ["'unsafe-eval'"] : [];
  const scriptSrc =
    surface === "app"
      ? ["'self'", `'nonce-${nonce ?? ""}'`, "'strict-dynamic'", ...devEval]
      : surface === "editor"
        ? // Dev: preamble React Refresh Vite berupa script inline.
          ["'self'", ...(env.isDev ? ["'unsafe-inline'"] : [])]
        : ["'self'", "'unsafe-inline'", ...devEval];
  const connectSrc = [
    "'self'",
    ...env.connectOrigins,
    ...(surface === "editor" && env.isDev && env.editorDevSocket ? [env.editorDevSocket] : []),
  ];
  return directives([
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:", ...env.imageOrigins]],
    ["font-src", ["'self'", "data:", FONT_CDN_ORIGIN]],
    ["connect-src", connectSrc],
    ["worker-src", ["'self'", "blob:"]],
    // Iframe Turnstile (ACC-004, halaman login).
    ["frame-src", ["'self'", "https://challenges.cloudflare.com"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
    ...(env.isProduction ? ([["upgrade-insecure-requests", []]] as const) : []),
  ]);
}

/** Header respons untuk satu permukaan; `api` → kosong (milik apps/api). */
export function securityHeaders(surface: Surface, env: SecurityEnv, nonce?: string): Record<string, string> {
  if (surface === "api") return {};
  return {
    "content-security-policy": buildCsp(surface, env, nonce),
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "cross-origin-opener-policy": "same-origin",
    // PUB-211: `preload` baru setelah semua subdomain platform HTTPS (keputusan saat go-live).
    ...(env.isProduction ? { "strict-transport-security": "max-age=31536000; includeSubDomains" } : {}),
  };
}

/** Nonce acak per request (base64 dari 16 byte). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
