// @platform/shared/telemetry: scrubber event Sentry (ED-231, ARCHITECTURE §13) — fungsi murni tanpa import SDK
// (tipe struktural), dipakai editor & web (browser) serta api/worker/realtime (`@platform/shared/node`).
// Prinsip: konten user (teks dokumen, input, body request, cookie/header, email/IP) tidak pernah dikirim; URL tanpa
// query/fragment; ID mentah (UUID) diganti `:id` — korelasi lewat tag ter-hash/ID request.

export interface BreadcrumbLike {
  category?: string | undefined;
  message?: string | undefined;
  data?: Record<string, unknown> | undefined;
  [key: string]: unknown;
}

export interface EventLike {
  contexts?: Record<string, unknown> | undefined;
  extra?: unknown;
  user?: { id?: string | number | undefined; [key: string]: unknown } | undefined;
  request?: { url?: string | undefined; method?: string | undefined; [key: string]: unknown } | undefined;
  breadcrumbs?: BreadcrumbLike[] | undefined;
  transaction?: string | undefined;
  [key: string]: unknown;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Teks bebas (nama transaksi, tag) tanpa UUID mentah. */
export const redactIds = (value: string): string => value.replace(UUID, ":id");

/** URL/path tanpa query & fragment (token/parameter bisa memuat data) dan tanpa UUID mentah. */
export function stripUrl(url: string): string {
  const cut = url.search(/[?#]/);
  return redactIds(cut === -1 ? url : url.slice(0, cut));
}

// Browser: navigasi & request (URL saja) + aksi editor kita sendiri (nama aksi, tanpa isi). Klik/input/console dibuang.
const BROWSER_BREADCRUMBS = new Set(["navigation", "fetch", "xhr", "editor"]);
// Server: request HTTP keluar & navigasi; console/log bisa memuat payload.
const SERVER_BREADCRUMBS = new Set(["http", "navigation"]);
// Konteks bawaan SDK yang tidak memuat konten user.
const SAFE_CONTEXTS = new Set([
  "browser",
  "os",
  "device",
  "culture",
  "trace",
  "runtime",
  "app",
  "react",
  "cloud_resource",
]);

// Generik `T extends object`: tipe breadcrumb/event SDK Sentry (tanpa index signature) tetap diterima & dikembalikan.
export function scrubBreadcrumb<T extends object>(input: T, side: "browser" | "server" = "browser"): T | null {
  const breadcrumb = input as BreadcrumbLike;
  const category = breadcrumb.category ?? "";
  if (!(side === "browser" ? BROWSER_BREADCRUMBS : SERVER_BREADCRUMBS).has(category)) return null;
  const data = breadcrumb.data ?? {};
  if (category === "editor") {
    return {
      ...breadcrumb,
      data: {
        ...(typeof data.action === "string" ? { action: data.action } : {}),
        ...(typeof data.origin === "string" ? { origin: data.origin } : {}),
      },
    } as T;
  }
  const safe: Record<string, unknown> = {};
  for (const key of ["method", "status_code"]) if (key in data) safe[key] = data[key];
  for (const key of ["url", "from", "to"]) if (typeof data[key] === "string") safe[key] = stripUrl(data[key]);
  return { ...breadcrumb, data: safe, ...(breadcrumb.message ? { message: stripUrl(breadcrumb.message) } : {}) } as T;
}

/** Event tanpa konten user: konteks aman saja, tanpa `extra`, user hanya `id`, request hanya method + URL bersih. */
export function scrubEvent<T extends object>(event: T, side: "browser" | "server" = "browser"): T {
  const { extra: _extra, user, request, breadcrumbs, contexts, transaction, ...rest } = event as EventLike;
  return {
    ...rest,
    contexts: Object.fromEntries(Object.entries(contexts ?? {}).filter(([name]) => SAFE_CONTEXTS.has(name))),
    ...(transaction ? { transaction: redactIds(transaction) } : {}),
    ...(user?.id !== undefined ? { user: { id: user.id } } : {}),
    ...(request?.url || request?.method
      ? {
          request: {
            ...(request.method ? { method: request.method } : {}),
            ...(request.url ? { url: stripUrl(request.url) } : {}),
          },
        }
      : {}),
    breadcrumbs: (breadcrumbs ?? [])
      .map((crumb) => scrubBreadcrumb(crumb, side))
      .filter((crumb): crumb is BreadcrumbLike => crumb !== null),
  } as unknown as T;
}
