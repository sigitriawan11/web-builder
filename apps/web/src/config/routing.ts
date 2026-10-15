import { z } from "zod";

// Routing app.<domain> (ARCHITECTURE §3.4): `/api/*` → apps/api (prefix `/api` dibuang: api memasang `/v1/*` &
// `/auth/*`), `/editor/*` → origin statis editor (dev: Vite, base `/editor/`; SPA fallback ditangani origin itu).
// Dijalankan `beforeFiles` agar menang atas route App Router. Gate cookie sesi untuk `/editor` di middleware (T1.14.2).

export const WebRoutingEnvSchema = z.object({
  API_INTERNAL_URL: z.url(),
  EDITOR_ORIGIN: z.url(),
});
export type WebRoutingEnv = z.infer<typeof WebRoutingEnvSchema>;

export interface Rewrite {
  source: string;
  destination: string;
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");

export function platformRewrites(env: WebRoutingEnv): { beforeFiles: Rewrite[] } {
  const api = trimSlash(env.API_INTERNAL_URL);
  const editor = trimSlash(env.EDITOR_ORIGIN);
  return {
    beforeFiles: [
      { source: "/api/:path*", destination: `${api}/:path*` },
      { source: "/editor", destination: `${editor}/editor/` },
      { source: "/editor/:path*", destination: `${editor}/editor/:path*` },
    ],
  };
}

/** Env routing dari `process.env`; salah konfigurasi → gagal saat start/build dengan pesan jelas. */
export function loadRoutingEnv(source: Readonly<Record<string, string | undefined>> = process.env): WebRoutingEnv {
  const parsed = WebRoutingEnvSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`env apps/web tidak valid: ${fields} (lihat .env.example)`);
  }
  return parsed.data;
}
