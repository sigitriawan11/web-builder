import { lazy, Suspense } from "react";
import { CanvasViewport } from "../canvas/CanvasViewport";
import type { CanvasRuntime } from "../canvas/canvas-runtime";
import { createPlaygroundRuntime } from "../canvas/playground-runtime";
import { AppErrorBoundary } from "./ErrorBoundary";
import { initialLocale } from "./i18n";
import { AppProviders } from "./providers";
import { parseEditorRoute } from "./router";

// Rute produk dimuat terpisah (membawa CSS Tailwind/token UI) — lihat SiteEditor.tsx.
const SiteEditor = lazy(() => import("./SiteEditor").then((module) => ({ default: module.SiteEditor })));
const SiteNotFound = lazy(() => import("./SiteEditor").then((module) => ({ default: module.SiteNotFound })));
// Overlay preview memuat renderer statis — dipisah dari bundle utama; di playground dipakai untuk e2e.
const PreviewOverlay = lazy(() => import("./PreviewOverlay").then((module) => ({ default: module.PreviewOverlay })));
const CommandPalette = lazy(() =>
  import("../commands/palette/CommandPalette").then((module) => ({ default: module.CommandPalette })),
);
const CanvasContextMenu = lazy(() =>
  import("../commands/context-menu/CanvasContextMenu").then((module) => ({ default: module.CanvasContextMenu })),
);

// Bootstrap editor (ARCHITECTURE §5.2): providers → error boundary → rute.
export function App() {
  const route = parseEditorRoute(window.location.pathname, window.location.search);
  return (
    <AppProviders locale={initialLocale()}>
      <AppErrorBoundary>
        <Suspense fallback={null}>
          {route.kind === "site" ? (
            <SiteEditor siteId={route.siteId} pageId={route.pageId} />
          ) : route.kind === "playground" ? (
            <Playground />
          ) : (
            <SiteNotFound />
          )}
        </Suspense>
      </AppErrorBoundary>
    </AppProviders>
  );
}
// Playground canvas M0 (fixture & parameter `?…` untuk e2e/benchmark canvas) hanya di dev; production → dashboard.
function Playground() {
  if (!import.meta.env.DEV) {
    window.location.replace("/sites");
    return null;
  }
  return <PlaygroundCanvas />;
}

// Satu per muat halaman (fixture dari `?fixture=`), hidup selama tab. Bukan initializer useState: StrictMode
// memanggilnya dua kali sehingga `__spike` bisa menunjuk runtime yang dibuang.
let playgroundRuntime: CanvasRuntime | null = null;

function PlaygroundCanvas() {
  playgroundRuntime ??= createPlaygroundRuntime(window.location.search);
  return (
    <Suspense fallback={null}>
      <CanvasContextMenu runtime={playgroundRuntime} style={{ display: "contents" }}>
        <CanvasViewport runtime={playgroundRuntime} />
      </CanvasContextMenu>
      <PreviewOverlay runtime={playgroundRuntime} pageId={playgroundRuntime.pageId} />
      <CommandPalette runtime={playgroundRuntime} />
    </Suspense>
  );
}
