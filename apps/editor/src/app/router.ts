// Router editor (ARCHITECTURE §5.2): satu rute produk `/editor/:siteId` (+ `?page=<pageId>`). `/editor/` tanpa siteId =
// playground canvas M0 (dev & e2e canvas); di production dialihkan ke dashboard. Tanpa dependency router: rute
// sesedikit ini cukup dengan pencocok path.

export const EDITOR_BASE = "/editor/";

const UUID_BODY = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID = new RegExp(`^${UUID_BODY}$`, "i");
// ID node page (`pg_…`, spec 01 DM-007).
const PAGE_ID = /^pg_[A-Za-z0-9_-]{1,64}$/;
// Mode Admin: `/editor/library/components/<uuid>/draft` (CMP-010). Permukaan editing admin memakai UUID component
// (konsisten dengan API `/v1/admin/library/*`); `cmp_…` public_id dipakai untuk rujukan dokumen & read API published.
const LIBRARY_DRAFT = new RegExp(`^library/components/(${UUID_BODY})/draft$`, "i");
// Theme preset Mode Admin: `/editor/library/themes/<slug>` (CMP-124). Slug kebab-case.
const LIBRARY_THEME = /^library\/themes\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export type EditorRoute =
  | { kind: "site"; siteId: string; pageId: string | null }
  | { kind: "library"; componentId: string }
  | { kind: "theme"; slug: string }
  | { kind: "playground" }
  | { kind: "wysiwyg" }
  | { kind: "not-found" };

export function parseEditorRoute(pathname: string, search: string): EditorRoute {
  if (!pathname.startsWith(EDITOR_BASE.slice(0, -1))) return { kind: "not-found" };
  const rest = pathname.slice(EDITOR_BASE.length - 1).replace(/^\/+|\/+$/g, "");
  // Harness uji paritas WYSIWYG (T2.19.2, dev/e2e saja): render publish satu fixture di iframe.
  if (rest === "" && new URLSearchParams(search).get("harness") === "wysiwyg") return { kind: "wysiwyg" };
  if (rest === "") return { kind: "playground" };
  // Mode Admin library (CMP-010/ED-003) sebelum rute situs (keduanya di bawah /editor/).
  const library = LIBRARY_DRAFT.exec(rest);
  if (library?.[1]) return { kind: "library", componentId: library[1].toLowerCase() };
  // Edit theme preset Mode Admin (CMP-124).
  const theme = LIBRARY_THEME.exec(rest);
  if (theme?.[1]) return { kind: "theme", slug: theme[1] };
  if (rest.includes("/") || !UUID.test(rest)) return { kind: "not-found" };
  const page = new URLSearchParams(search).get("page");
  return { kind: "site", siteId: rest.toLowerCase(), pageId: page && PAGE_ID.test(page) ? page : null };
}

/** URL editor untuk situs/page (dipakai navigasi antar page, T1.15.x). */
export function editorUrl(siteId: string, pageId?: string | null): string {
  return `${EDITOR_BASE}${siteId}${pageId ? `?page=${encodeURIComponent(pageId)}` : ""}`;
}

/** URL editor Mode Admin untuk draft component (CMP-010); `componentId` = UUID component (bukan `cmp_…`). */
export function libraryDraftUrl(componentId: string): string {
  if (!UUID.test(componentId)) throw new Error(`componentId (UUID) tidak valid: ${componentId}`);
  return `${EDITOR_BASE}library/components/${componentId.toLowerCase()}/draft`;
}

/** URL editor Mode Admin untuk edit theme preset (CMP-124); `slug` kebab-case. */
export function libraryThemeUrl(slug: string): string {
  if (!LIBRARY_THEME.test(`library/themes/${slug}`)) throw new Error(`slug theme tidak valid: ${slug}`);
  return `${EDITOR_BASE}library/themes/${slug}`;
}
