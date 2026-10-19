// Router editor (ARCHITECTURE §5.2): satu rute produk `/editor/:siteId` (+ `?page=<pageId>`). `/editor/` tanpa siteId =
// playground canvas M0 (dev & e2e canvas); di production dialihkan ke dashboard. Tanpa dependency router: rute
// sesedikit ini cukup dengan pencocok path.

export const EDITOR_BASE = "/editor/";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ID node page (`pg_…`, spec 01 DM-007).
const PAGE_ID = /^pg_[A-Za-z0-9_-]{1,64}$/;
// ID publik component (`cmp_…`, spec 01 DM-007) yang dirujuk dokumen & URL Mode Admin (CMP-010).
const COMPONENT_PUBLIC_ID = /^cmp_[0-9a-z]{6,24}$/;
// Mode Admin: `/editor/library/components/<cmp_…>/draft` (CMP-010). Dokumen = ComponentDefinition draft, bukan situs.
const LIBRARY_DRAFT = /^library\/components\/(cmp_[0-9a-z]{6,24})\/draft$/;

export type EditorRoute =
  | { kind: "site"; siteId: string; pageId: string | null }
  | { kind: "library"; componentId: string }
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
  if (library?.[1]) return { kind: "library", componentId: library[1] };
  if (rest.includes("/") || !UUID.test(rest)) return { kind: "not-found" };
  const page = new URLSearchParams(search).get("page");
  return { kind: "site", siteId: rest.toLowerCase(), pageId: page && PAGE_ID.test(page) ? page : null };
}

/** URL editor untuk situs/page (dipakai navigasi antar page, T1.15.x). */
export function editorUrl(siteId: string, pageId?: string | null): string {
  return `${EDITOR_BASE}${siteId}${pageId ? `?page=${encodeURIComponent(pageId)}` : ""}`;
}

/** URL editor Mode Admin untuk draft component (CMP-010). */
export function libraryDraftUrl(componentId: string): string {
  if (!COMPONENT_PUBLIC_ID.test(componentId)) throw new Error(`componentId tidak valid: ${componentId}`);
  return `${EDITOR_BASE}library/components/${componentId}/draft`;
}
