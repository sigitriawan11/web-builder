import { z } from "zod";

// Routing app.<domain> (ARCHITECTURE §3.4): `/api/*` → apps/api (prefix `/api` dibuang: api memasang `/v1/*` &
// `/auth/*`) lewat rewrites `beforeFiles`. `/editor/*` → origin statis editor (dev: Vite, base `/editor/`; SPA
// fallback ditangani origin itu) di-rewrite oleh PROXY (`editorRewriteUrl`), bukan next.config: header respons proxy
// (CSP/anti-frame, PUB-211) hanya ikut pada rewrite yang dilakukan proxy sendiri (diverifikasi T1.14.3).

export const WebEnvSchema = z.object({
  API_INTERNAL_URL: z.url(),
  EDITOR_ORIGIN: z.url(),
  // Host routing (proxy): apex = marketing, `app.` = auth/dashboard/admin/editor (ARCHITECTURE §3).
  PUBLIC_APP_URL: z.url(),
  PUBLIC_MARKETING_URL: z.url(),
  // Header keamanan (PUB-211): HSTS hanya production; connect-src/img-src dari origin publik.
  APP_ENV: z.enum(["local", "staging", "production"]).default("local"),
  PUBLIC_API_URL: z.url(),
  PUBLIC_REALTIME_URL: z.url(),
  PUBLIC_ASSETS_URL: z.url(),
  NEXT_PUBLIC_SENTRY_DSN: z.union([z.url(), z.literal("")]).optional(),
});
export type WebEnv = z.infer<typeof WebEnvSchema>;

export interface Rewrite {
  source: string;
  destination: string;
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");

export function platformRewrites(env: Pick<WebEnv, "API_INTERNAL_URL">): { beforeFiles: Rewrite[] } {
  const api = trimSlash(env.API_INTERNAL_URL);
  return { beforeFiles: [{ source: "/api/:path*", destination: `${api}/:path*` }] };
}

/** URL tujuan rewrite editor untuk path `/editor…` (`/editor` → `/editor/`, base Vite). */
export function editorRewriteUrl(env: Pick<WebEnv, "EDITOR_ORIGIN">, pathname: string, search: string): string {
  const path = pathname === "/editor" ? "/editor/" : pathname;
  return `${trimSlash(env.EDITOR_ORIGIN)}${path}${search}`;
}

/** Env apps/web dari `process.env`; salah konfigurasi → gagal saat start/build dengan pesan jelas. */
export function loadWebEnv(source: Readonly<Record<string, string | undefined>> = process.env): WebEnv {
  const parsed = WebEnvSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`env apps/web tidak valid: ${fields} (lihat .env.example)`);
  }
  return parsed.data;
}
