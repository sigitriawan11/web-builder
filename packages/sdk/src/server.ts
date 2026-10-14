import { type ApiClientOptions, createApiClient, REQUEST_ID_HEADER } from "./client";
import { createPlatformApi, type PlatformApi } from "./endpoints";

// Client untuk Server Component / Route Handler Next.js (ARCHITECTURE §5.1): `baseUrl = API_INTERNAL_URL`, header
// request browser diteruskan ke api. ALLOWLIST eksplisit — header lain (host, content-length, authorization dari
// proxy, …) tidak ikut.

export const FORWARDED_HEADERS = [
  // Sesi Better Auth.
  "cookie",
  // Korelasi log web ↔ api (dibuat middleware web, T1.14.2).
  REQUEST_ID_HEADER,
  // Pesan error dilokalkan (ACC-290).
  "accept-language",
  "user-agent",
  // IP asli user untuk rate limit & audit di api (api `trust proxy` 1 = web).
  "x-forwarded-for",
] as const;

/** Bentuk minimal `headers()` Next.js / `Request.headers`. */
export interface IncomingHeaders {
  get(name: string): string | null;
}

export function forwardedHeaders(incoming: IncomingHeaders): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of FORWARDED_HEADERS) {
    const value = incoming.get(name);
    if (value) result[name] = value;
  }
  return result;
}

export function apiServer(
  incoming: IncomingHeaders,
  options: Pick<ApiClientOptions, "baseUrl" | "fetch" | "timeoutMs">,
): PlatformApi {
  const headers = forwardedHeaders(incoming);
  return createPlatformApi(
    createApiClient({
      ...options,
      getHeaders: () => headers,
      // Server-ke-server: tidak ada cookie jar browser; cookie diteruskan eksplisit di header.
      credentials: "omit",
    }),
  );
}
