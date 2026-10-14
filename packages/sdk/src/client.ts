import { uuidv7 } from "@platform/shared";
import { ErrorBodySchema } from "@platform/shared/contracts";
import type { z } from "zod";
import { ApiError } from "./errors";

// Fetch wrapper Platform API (ARCHITECTURE §4.2, §5.1): `x-request-id` per request, `Accept-Language` (pesan
// error dilokalkan server, ACC-290), body JSON, timeout, respons divalidasi schema kontrak, error → ApiError.

export const REQUEST_ID_HEADER = "x-request-id";
export const DEFAULT_TIMEOUT_MS = 30_000;

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiClientOptions {
  // Browser: "/api" (same-origin lewat web); server Next.js: API_INTERNAL_URL.
  baseUrl: string;
  fetch?: typeof fetch;
  // Header tambahan per request (mis. cookie & x-request-id yang diteruskan server Next.js, T1.7.2).
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  // Bahasa UI user → `Accept-Language`.
  locale?: () => string | undefined;
  timeoutMs?: number;
  // Default "same-origin" (cookie sesi ikut bila sama origin).
  credentials?: RequestCredentials;
}

export interface RequestOptions<S extends z.ZodType> {
  query?: Readonly<Record<string, QueryValue>>;
  body?: unknown;
  // Schema respons (envelope). Tanpa schema = respons tanpa body (204).
  schema?: S;
  signal?: AbortSignal;
}

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

function buildUrl(baseUrl: string, path: string, query?: Readonly<Record<string, QueryValue>>): string {
  const base = baseUrl.replace(/\/+$/, "");
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const queryString = search.toString();
  return `${base}${path.startsWith("/") ? path : `/${path}`}${queryString ? `?${queryString}` : ""}`;
}

function retryAfter(response: Response): number | undefined {
  const value = Number(response.headers.get("retry-after"));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export interface ApiClient {
  request<S extends z.ZodType = z.ZodVoid>(
    method: HttpMethod,
    path: string,
    options?: RequestOptions<S>,
  ): Promise<z.infer<S>>;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return {
    async request(method, path, requestOptions = {}) {
      const extra = (await options.getHeaders?.()) ?? {};
      const requestId = extra[REQUEST_ID_HEADER] ?? uuidv7();
      const locale = options.locale?.();
      const headers: Record<string, string> = {
        accept: "application/json",
        ...extra,
        [REQUEST_ID_HEADER]: requestId,
        ...(locale ? { "accept-language": locale } : {}),
        ...(requestOptions.body === undefined ? {} : { "content-type": "application/json" }),
      };

      // Dibatalkan pemanggil sebelum request dikirim → jangan kirim sama sekali.
      requestOptions.signal?.throwIfAborted();
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = requestOptions.signal ? AbortSignal.any([requestOptions.signal, timeout]) : timeout;
      let response: Response;
      try {
        response = await fetchImpl(buildUrl(options.baseUrl, path, requestOptions.query), {
          method,
          headers,
          credentials: options.credentials ?? "same-origin",
          signal,
          ...(requestOptions.body === undefined ? {} : { body: JSON.stringify(requestOptions.body) }),
        });
      } catch (error) {
        // Pembatalan oleh pemanggil diteruskan apa adanya (bukan error API).
        if (requestOptions.signal?.aborted) throw error;
        const timedOut = timeout.aborted;
        throw new ApiError({
          code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
          status: 0,
          message: timedOut ? `Request melewati batas ${timeoutMs} ms` : "Tidak bisa menghubungi server",
          requestId,
          cause: error,
        });
      }

      const responseRequestId = response.headers.get(REQUEST_ID_HEADER) ?? requestId;
      const text = await response.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        json = undefined;
      }

      if (!response.ok) {
        const body = ErrorBodySchema.safeParse(json);
        if (body.success) throw ApiError.fromBody(body.data, response.status, retryAfter(response));
        throw new ApiError({
          code: "INVALID_RESPONSE",
          status: response.status,
          message: `Respons error tidak dikenali (HTTP ${response.status})`,
          requestId: responseRequestId,
        });
      }
      if (!requestOptions.schema) return undefined as never;
      const parsed = requestOptions.schema.safeParse(json);
      if (!parsed.success) {
        throw new ApiError({
          code: "INVALID_RESPONSE",
          status: response.status,
          message: "Bentuk respons tidak sesuai kontrak",
          requestId: responseRequestId,
          details: {
            issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
          },
        });
      }
      return parsed.data;
    },
  };
}
