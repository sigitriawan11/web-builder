import type { Breadcrumb, ErrorEvent } from "@sentry/react";

// ED-231 / ARCHITECTURE §14: Sentry TIDAK boleh menerima konten user (teks/gambar dokumen, input form). Scrubber ini
// dipasang di `beforeSend` & `beforeBreadcrumb`: hanya kategori yang tidak membawa konten yang lolos, URL tanpa query.

// Breadcrumb yang aman: navigasi & request (URL saja), plus aksi editor kita sendiri (nama command/aksi, tanpa isi).
const SAFE_BREADCRUMB_CATEGORIES = new Set(["navigation", "fetch", "xhr", "editor"]);
// Konteks bawaan SDK yang tidak memuat konten user.
const SAFE_CONTEXTS = new Set(["browser", "os", "device", "culture", "trace", "runtime", "app", "react"]);

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * URL tanpa query & fragment (token/parameter bisa memuat data) dan tanpa ID mentah (`/editor/<siteId>` → `:id`;
 * situs dikorelasikan lewat tag `site` ter-hash).
 */
export function stripUrl(url: string): string {
  const cut = url.search(/[?#]/);
  return (cut === -1 ? url : url.slice(0, cut)).replace(UUID, ":id");
}

// Teks bebas lain dari SDK (nama transaksi = URL) juga tanpa ID mentah.
const redactIds = (value: string) => value.replace(UUID, ":id");

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  const category = breadcrumb.category ?? "";
  if (!SAFE_BREADCRUMB_CATEGORIES.has(category)) return null;
  const data = breadcrumb.data ?? {};
  if (category === "editor") {
    // Aksi editor: hanya nama aksi & origin; field lain dibuang.
    return {
      ...breadcrumb,
      data: {
        ...(typeof data.action === "string" ? { action: data.action } : {}),
        ...(typeof data.origin === "string" ? { origin: data.origin } : {}),
      },
    };
  }
  const safe: Record<string, unknown> = {};
  for (const key of ["method", "status_code"]) if (key in data) safe[key] = data[key];
  for (const key of ["url", "from", "to"]) if (typeof data[key] === "string") safe[key] = stripUrl(data[key]);
  return { ...breadcrumb, data: safe, ...(breadcrumb.message ? { message: stripUrl(breadcrumb.message) } : {}) };
}

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const contexts = Object.fromEntries(
    Object.entries(event.contexts ?? {}).filter(([name]) => SAFE_CONTEXTS.has(name)),
  ) as NonNullable<ErrorEvent["contexts"]>;
  const { extra: _extra, user, request, breadcrumbs, ...rest } = event;
  return {
    ...rest,
    ...(rest.transaction ? { transaction: redactIds(rest.transaction) } : {}),
    contexts,
    // Hanya ID ter-hash yang ditetapkan aplikasi (setUser({ id })), tanpa email/IP/username.
    ...(user?.id ? { user: { id: user.id } } : {}),
    ...(request?.url ? { request: { url: stripUrl(request.url) } } : {}),
    breadcrumbs: (breadcrumbs ?? []).map(scrubBreadcrumb).filter((crumb): crumb is Breadcrumb => crumb !== null),
  };
}
