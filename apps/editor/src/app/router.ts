// Router editor (ARCHITECTURE §5.2): satu rute produk `/editor/:siteId` (+ `?page=<pageId>`). `/editor/` tanpa siteId =
// playground canvas M0 (dev & e2e canvas); di production dialihkan ke dashboard. Tanpa dependency router: rute
// sesedikit ini cukup dengan pencocok path.

export const EDITOR_BASE = "/editor/";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ID node page (`pg_…`, spec 01 DM-007).
const PAGE_ID = /^pg_[A-Za-z0-9_-]{1,64}$/;

export type EditorRoute =
  | { kind: "site"; siteId: string; pageId: string | null }
  | { kind: "playground" }
  | { kind: "not-found" };

export function parseEditorRoute(pathname: string, search: string): EditorRoute {
  if (!pathname.startsWith(EDITOR_BASE.slice(0, -1))) return { kind: "not-found" };
  const rest = pathname.slice(EDITOR_BASE.length - 1).replace(/^\/+|\/+$/g, "");
  if (rest === "") return { kind: "playground" };
  if (rest.includes("/") || !UUID.test(rest)) return { kind: "not-found" };
  const page = new URLSearchParams(search).get("page");
  return { kind: "site", siteId: rest.toLowerCase(), pageId: page && PAGE_ID.test(page) ? page : null };
}

/** URL editor untuk situs/page (dipakai navigasi antar page, T1.15.x). */
export function editorUrl(siteId: string, pageId?: string | null): string {
  return `${EDITOR_BASE}${siteId}${pageId ? `?page=${encodeURIComponent(pageId)}` : ""}`;
}
