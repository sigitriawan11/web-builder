// Klien HTTP halaman auth (browser → `/api/*` same-origin, ARCHITECTURE §3.4). Endpoint Better Auth mengembalikan
// error `{ code, message }`, sedangkan guard api (WEAK_PASSWORD, CAPTCHA_REQUIRED, RATE_LIMITED, …) memakai envelope
// `{ error: { code, message, details } }` — keduanya diseragamkan di sini.

export type ApiFailure = {
  ok: false;
  status: number;
  code: string;
  details: Readonly<Record<string, unknown>>;
  retryAfterSeconds: number | null;
};
export type ApiResult<T> = { ok: true; status: number; data: T } | ApiFailure;

// Kode sintetis bila tidak ada respons/badan yang bisa dibaca.
export const NETWORK_ERROR = "NETWORK_ERROR";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Bentuk error seragam dari status + badan JSON (envelope api atau Better Auth) + header Retry-After. */
export function toFailure(status: number, body: unknown, retryAfter: string | null): ApiFailure {
  const envelope = isRecord(body) && isRecord(body.error) ? body.error : null;
  const code =
    (envelope && typeof envelope.code === "string" && envelope.code) ||
    (isRecord(body) && typeof body.code === "string" && body.code) ||
    (status === 429 ? "RATE_LIMITED" : `HTTP_${status}`);
  const details = envelope && isRecord(envelope.details) ? envelope.details : {};
  const fromDetails = typeof details.retryAfterSeconds === "number" ? details.retryAfterSeconds : null;
  const fromHeader = retryAfter !== null && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
  return { ok: false, status, code, details, retryAfterSeconds: fromHeader ?? fromDetails };
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  headers?: HeadersInit,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    return { ok: false, status: 0, code: NETWORK_ERROR, details: {}, retryAfterSeconds: null };
  }
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) return toFailure(response.status, parsed, response.headers.get("retry-after"));
  return { ok: true, status: response.status, data: parsed as T };
}

export const apiPost = <T = unknown>(path: string, body: unknown, headers?: HeadersInit) =>
  request<T>("POST", path, body, headers);
export const apiGet = <T = unknown>(path: string) => request<T>("GET", path);

export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

/** Sesi Better Auth saat ini (`null` bila belum masuk). */
export async function getSession(): Promise<{ user: SessionUser } | null> {
  const result = await apiGet<{ user: SessionUser } | null>("/auth/get-session");
  return result.ok && result.data?.user ? result.data : null;
}
