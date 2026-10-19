import { lazy, Suspense } from "react";
import { AppErrorBoundary } from "./ErrorBoundary";
import { initialLocale } from "./i18n";
import { AppProviders } from "./providers";
import { parseEditorRoute } from "./router";

// Rute dimuat LAZY agar bundle awal (ED-226) hanya berisi shell app: engine canvas (Tiptap, dnd-kit, renderer) ikut
// chunk rute (SiteEditor produk / Playground dev), bukan entry.
const SiteEditor = lazy(() => import("./SiteEditor").then((module) => ({ default: module.SiteEditor })));
const SiteNotFound = lazy(() => import("./SiteEditor").then((module) => ({ default: module.SiteNotFound })));
const LibraryEditor = lazy(() => import("./LibraryEditor").then((module) => ({ default: module.LibraryEditor })));
const Playground = lazy(() => import("./Playground").then((module) => ({ default: module.Playground })));
const WysiwygHarness = lazy(() => import("./WysiwygHarness").then((module) => ({ default: module.WysiwygHarness })));

// Bootstrap editor (ARCHITECTURE §5.2): providers → error boundary → rute.
export function App() {
  const route = parseEditorRoute(window.location.pathname, window.location.search);
  return (
    <AppProviders locale={initialLocale()}>
      <AppErrorBoundary>
        <Suspense fallback={null}>
          {route.kind === "site" ? (
            <SiteEditor siteId={route.siteId} pageId={route.pageId} />
          ) : route.kind === "library" ? (
            <LibraryEditor componentId={route.componentId} />
          ) : route.kind === "playground" ? (
            <Playground />
          ) : route.kind === "wysiwyg" ? (
            <WysiwygHarness />
          ) : (
            <SiteNotFound />
          )}
        </Suspense>
      </AppErrorBoundary>
    </AppProviders>
  );
}
