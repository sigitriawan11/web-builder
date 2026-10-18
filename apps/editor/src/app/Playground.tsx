import { Suspense } from "react";
import { CanvasViewport } from "../canvas/CanvasViewport";
import type { CanvasRuntime } from "../canvas/canvas-runtime";
import { createPlaygroundRuntime } from "../canvas/playground-runtime";
import { CanvasContextMenu } from "../commands/context-menu/CanvasContextMenu";
import { CommandPalette } from "../commands/palette/CommandPalette";
import { PreviewOverlay } from "./PreviewOverlay";

// Playground canvas M0 (fixture & parameter `?…` untuk e2e/benchmark canvas). Dimuat LAZY oleh App agar engine canvas
// (Tiptap, dnd-kit, renderer) tidak masuk bundle awal produk (ED-226). Hanya dev; production → dashboard.

// Satu per muat halaman (fixture dari `?fixture=`), hidup selama tab. Bukan initializer useState: StrictMode
// memanggilnya dua kali sehingga `__spike` bisa menunjuk runtime yang dibuang.
let playgroundRuntime: CanvasRuntime | null = null;

export function Playground() {
  if (!import.meta.env.DEV) {
    window.location.replace("/sites");
    return null;
  }
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
