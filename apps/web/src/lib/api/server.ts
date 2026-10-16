import "server-only";
import { apiServer, isApiError, type PlatformApi } from "@platform/sdk";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loadWebEnv } from "../../config/routing";

// Panggilan api dari Server Component (ARCHITECTURE §5.1): `@platform/sdk` `apiServer` ke `API_INTERNAL_URL` dengan
// header browser yang diizinkan (cookie sesi, x-request-id, accept-language, user-agent, x-forwarded-for). Next.js tidak
// mengakses database; aturan bisnis & isolasi tenant tetap di apps/api. Satu instance per request (`cache`).
export const getServerApi = cache(async (): Promise<PlatformApi> => {
  return apiServer(await headers(), { baseUrl: loadWebEnv().API_INTERNAL_URL.replace(/\/$/, "") });
});

/** Jalankan panggilan api; sesi tidak valid (401 — cookie basi, proxy hanya memeriksa keberadaan) → `/login`. */
export async function withSession<T>(call: (api: PlatformApi) => Promise<T>, loginNext?: string): Promise<T> {
  try {
    return await call(await getServerApi());
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      redirect(loginNext ? `/login?next=${encodeURIComponent(loginNext)}` : "/login");
    }
    throw error;
  }
}
