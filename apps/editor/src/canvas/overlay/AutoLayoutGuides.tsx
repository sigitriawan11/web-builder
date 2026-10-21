import type { Theme } from "@platform/document-model";
import { listTokenPaths, resolveStyle, resolveToken, runCommand, updateStyle } from "@platform/document-model";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import { useDocTheme } from "../../document/use-doc-theme";
import { previewStore } from "../../store/preview-store";
import { selectionStore } from "../../store/selection-store";
import { cameraStore } from "../camera-store";
import { useCanvasRuntime } from "../canvas-runtime";
import type { WorldRect } from "../geometry/geometry-store";

// ED-096: helper auto-layout di canvas. Frame flex terseleksi → area padding (pink) + pita gap (pink) + handle drag di
// gap pertama untuk mengubah nilai gap langsung (snap ke token `space.*` terdekat; tahan Mod = nilai bebas).
// Child sizing icon saat hover = menyusul. Handle kirim perubahan via previewStore (live) lalu commit saat dilepas.

const TOKEN_SNAP_PX = 6; // ambang snap ke token (world px)

function resolveLen(len: unknown, theme: Theme | null): number {
  if (len && typeof len === "object") {
    if ("$token" in len && theme) {
      const value = resolveToken(theme, (len as { $token: string }).$token);
      return typeof value === "number" ? value : 0;
    }
    if ("value" in len) return (len as { value: number }).value;
  }
  return 0;
}

function spaceTokens(theme: Theme | null): { path: string; px: number }[] {
  if (!theme) return [];
  return listTokenPaths(theme)
    .filter((path) => path.startsWith("space."))
    .flatMap((path) => {
      const value = resolveToken(theme, path);
      return typeof value === "number" ? [{ path, px: value }] : [];
    });
}

export function AutoLayoutGuides() {
  const t = useT();
  const runtime = useCanvasRuntime();
  const camera = useStore(cameraStore);
  const selectedIds = useStore(selectionStore, (state) => state.selectedIds);
  const theme = useDocTheme(runtime.doc);

  const id = selectedIds.length === 1 ? selectedIds[0] : undefined;
  const node = id ? runtime.nodeStore.getNode(id) : null;
  const layout = node ? resolveStyle(node.style, "base").layout : undefined;
  if (!id || !node || !("children" in node) || layout?.mode !== "flex") return null;

  const frame = runtime.geometry.store.getRect(id);
  if (!frame) return null;
  const childRects = node.children
    .map((childId) => runtime.geometry.store.getRect(childId))
    .filter((rect): rect is WorldRect => rect !== null)
    .sort((a, b) => (layout.direction === "column" ? a.y - b.y : a.x - b.x));

  const toScreen = (rect: WorldRect) => ({
    left: rect.x * camera.zoom + camera.x,
    top: rect.y * camera.zoom + camera.y,
    width: rect.width * camera.zoom,
    height: rect.height * camera.zoom,
  });

  // Area padding (pink) = selisih frame vs kotak konten (inset padding).
  const pad = {
    top: resolveLen(layout.padding?.top, theme),
    right: resolveLen(layout.padding?.right, theme),
    bottom: resolveLen(layout.padding?.bottom, theme),
    left: resolveLen(layout.padding?.left, theme),
  };
  const fs = toScreen(frame);
  const z = camera.zoom;
  const paddingBands = [
    { key: "t", left: fs.left, top: fs.top, width: fs.width, height: pad.top * z },
    { key: "b", left: fs.left, top: fs.top + fs.height - pad.bottom * z, width: fs.width, height: pad.bottom * z },
    {
      key: "l",
      left: fs.left,
      top: fs.top + pad.top * z,
      width: pad.left * z,
      height: fs.height - (pad.top + pad.bottom) * z,
    },
    {
      key: "r",
      left: fs.left + fs.width - pad.right * z,
      top: fs.top + pad.top * z,
      width: pad.right * z,
      height: fs.height - (pad.top + pad.bottom) * z,
    },
  ].filter((b) => b.width > 0 && b.height > 0);

  // Pita gap antar anak berurutan (pink) sepanjang sumbu utama.
  const column = layout.direction === "column";
  const gapBands = childRects.slice(0, -1).map((rect, index) => {
    const next = childRects[index + 1] as WorldRect;
    const gapWorld = column ? next.y - (rect.y + rect.height) : next.x - (rect.x + rect.width);
    const band = column
      ? { x: rect.x, y: rect.y + rect.height, width: rect.width, height: Math.max(0, gapWorld) }
      : { x: rect.x + rect.width, y: rect.y, width: Math.max(0, gapWorld), height: rect.height };
    return { index, gapWorld, screen: toScreen(band) };
  });
  const first = gapBands[0];

  const startGapDrag = (event: React.PointerEvent) => {
    if (!first) return;
    event.preventDefault();
    event.stopPropagation();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    const startGap = first.gapWorld;
    const startPos = column ? event.clientY : event.clientX;
    const tokens = spaceTokens(theme);
    let applied = startGap;

    const onMove = (move: PointerEvent) => {
      const deltaWorld = ((column ? move.clientY : move.clientX) - startPos) / camera.zoom;
      let next = Math.max(0, Math.round(startGap + deltaWorld));
      let tokenPath: string | undefined;
      // Snap ke token terdekat kecuali Mod (nilai bebas).
      if (!(move.ctrlKey || move.metaKey)) {
        for (const token of tokens) {
          if (Math.abs(token.px - next) <= TOKEN_SNAP_PX) {
            next = token.px;
            tokenPath = token.path;
            break;
          }
        }
      }
      applied = next;
      const gap = tokenPath ? { $token: tokenPath } : { value: next, unit: "px" as const };
      previewStore.getState().setStyle(id, { layout: { gap } });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const style = previewStore.getState().styles[id];
      previewStore.getState().clear([id]);
      const gap = style?.layout && "gap" in style.layout ? style.layout.gap : { value: applied, unit: "px" as const };
      runtime.undo.stopCapturing();
      runCommand(runtime.commandCtx, updateStyle, { ids: [id], patch: { layout: { gap } } });
      runtime.undo.stopCapturing();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div className="overlay-autolayout" data-testid="autolayout-guides" aria-hidden>
      {paddingBands.map((band) => (
        <div
          key={band.key}
          className="overlay-al-padding"
          style={{ left: band.left, top: band.top, width: band.width, height: band.height }}
        />
      ))}
      {gapBands.map((band) => (
        <div
          key={band.index}
          className="overlay-al-gap"
          style={{ left: band.screen.left, top: band.screen.top, width: band.screen.width, height: band.screen.height }}
        />
      ))}
      {first ? (
        <button
          type="button"
          className="overlay-al-gap-handle"
          data-testid="autolayout-gap-handle"
          aria-label={t("autoLayoutGuides.gapHandle")}
          onPointerDown={startGapDrag}
          style={{
            left: first.screen.left + first.screen.width / 2,
            top: first.screen.top + first.screen.height / 2,
            cursor: column ? "ns-resize" : "ew-resize",
          }}
        />
      ) : null}
    </div>
  );
}
