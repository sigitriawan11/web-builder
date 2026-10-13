import { resolveStyle } from "@platform/document-model";
import { useStore } from "zustand";
import type { NodeStore } from "../../document/node-store";
import { previewStore } from "../../store/preview-store";
import { selectionStore } from "../../store/selection-store";
import { textEditingStore } from "../../store/text-editing-store";
import { cameraStore } from "../camera-store";
import type { GeometryStore } from "../geometry/geometry-store";
import type { ResizeHandle } from "../interactions/interaction-machine";
import { handlePositions, sizeLabel, unionRect } from "./selection-geometry";
import { useWorldRects } from "./use-world-rects";

const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
};

// Label ukuran & nama: hanya untuk satu node; multi-seleksi menampilkan ukuran gabungan.
function describeSingle(nodeStore: NodeStore, id: string) {
  const node = nodeStore.getNode(id);
  const parent = node?.parentId ? nodeStore.getNode(node.parentId) : null;
  if (!node) return null;
  const size = resolveStyle(node.style, "base").size;
  return {
    modes: { width: size?.width?.mode, height: size?.height?.mode },
    inAutoLayout: parent ? resolveStyle(parent.style, "base").layout?.mode === "flex" : false,
    // ED-060: nama tampil di atas untuk frame top-level (anak langsung page).
    topLevelName: node.type === "frame" && parent?.type === "page" ? node.name : null,
  };
}

interface SelectionOverlayProps {
  nodeStore: NodeStore;
  geometry: GeometryStore;
}

/**
 * ED-060: kotak seleksi 1px, 8 handle (terlihat 6×6, area klik 10×10 — ED-014), label W × H di bawah,
 * dan nama frame top-level di atas. Semua dalam px screen sehingga tidak ikut membesar saat zoom.
 */
export function SelectionOverlay({ nodeStore, geometry }: SelectionOverlayProps) {
  const selectedIds = useStore(selectionStore, (state) => state.selectedIds);
  const editing = useStore(textEditingStore, (state) => state.editingId !== null);
  const camera = useStore(cameraStore);
  const offset = useStore(previewStore, (state) => state.offset);
  // Node yang sedang dipindah digeser sementara (ED-024): kotak seleksi ikut tanpa menunggu ukur ulang.
  const rects = useWorldRects(geometry, selectedIds).map((rect, index) =>
    rect && offset?.ids.includes(selectedIds[index] ?? "")
      ? { ...rect, x: rect.x + offset.dx, y: rect.y + offset.dy }
      : rect,
  );

  const measured = rects.filter((rect) => rect !== null);
  const world = unionRect(measured);
  if (!world || measured.length !== selectedIds.length) return null;

  const screen = {
    x: world.x * camera.zoom + camera.x,
    y: world.y * camera.zoom + camera.y,
    width: world.width * camera.zoom,
    height: world.height * camera.zoom,
  };
  const single = selectedIds.length === 1 && selectedIds[0] ? describeSingle(nodeStore, selectedIds[0]) : null;
  const label = sizeLabel(world, single?.modes ?? { width: "fixed", height: "fixed" }, single?.inAutoLayout ?? false);
  // Handle resize hanya untuk satu node (resize multi-seleksi menyusul bersama transform, M2).
  const handleNode = selectedIds.length === 1 ? selectedIds[0] : undefined;

  return (
    <>
      {selectedIds.length > 1 &&
        measured.map((rect, index) => (
          <div
            key={selectedIds[index]}
            className="overlay-outline overlay-selection-member"
            style={{
              transform: `translate(${rect.x * camera.zoom + camera.x}px, ${rect.y * camera.zoom + camera.y}px)`,
              width: rect.width * camera.zoom,
              height: rect.height * camera.zoom,
            }}
          />
        ))}
      <div
        className="overlay-outline overlay-selection-outline"
        style={{ transform: `translate(${screen.x}px, ${screen.y}px)`, width: screen.width, height: screen.height }}
      />
      {!editing && single?.topLevelName && (
        <div className="overlay-name-label" style={{ transform: `translate(${screen.x}px, ${screen.y - 18}px)` }}>
          {single.topLevelName}
        </div>
      )}
      {!editing &&
        handleNode &&
        handlePositions(screen).map(({ handle, x, y }) => (
          <div
            key={handle}
            className="overlay-handle"
            data-handle={handle}
            data-handle-node={handleNode}
            style={{ transform: `translate(${x}px, ${y}px)`, cursor: HANDLE_CURSOR[handle] }}
          />
        ))}
      {!editing && (
        <div
          className="overlay-size-label"
          style={{
            transform: `translate(${screen.x + screen.width / 2}px, ${screen.y + screen.height + 8}px) translateX(-50%)`,
          }}
        >
          {label}
        </div>
      )}
    </>
  );
}
