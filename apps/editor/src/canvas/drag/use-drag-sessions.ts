import { moveNode, type OpContext, type PositionStyle, resolveStyle, runOp, updateStyle } from "@platform/document-model";
import { useEffect } from "react";
import type { NodeStore } from "../../document/node-store";
import { interactionStore } from "../../store/interaction-store";
import { previewStore } from "../../store/preview-store";
import { selectionStore } from "../../store/selection-store";
import { nodeLookupFrom } from "../../tools/select/node-lookup";
import { resolveClickSelection } from "../../tools/select/selection-depth";
import { cameraStore } from "../camera-store";
import { screenDeltaToWorld, screenPoint, screenToWorld } from "../geometry/coordinates";
import type { GeometryStore, WorldRect } from "../geometry/geometry-store";
import type { InteractionState } from "../interactions/interaction-machine";
import { moveDelta, movedPosition } from "./move";
import { type ChildBox, insertionMarker, reorderIndex } from "./reorder";
import { resizePatch, resizeRect } from "./resize";
import { clearPreviewTranslate, setPreviewTranslate } from "./transform-preview";

export interface DragSessionDeps {
  // Konteks op dengan origin lokal: commit masuk UndoManager sebagai satu langkah.
  opContext: OpContext;
  geometry: GeometryStore;
  nodeStore: NodeStore;
  // Untuk reorder (ED-063): node di bawah pointer & posisi viewport (konversi screen → world).
  hitTest(clientX: number, clientY: number): { nodeId: string; path: readonly string[] } | null;
  viewportOffset(): { left: number; top: number };
}

type ResizeState = Extract<InteractionState, { type: "dragResize" }>;
type MoveState = Extract<InteractionState, { type: "dragMove" }>;

interface MoveItem {
  id: string;
  start: { x: number; y: number };
  element: Element | null;
}

// ED-063: satu anak auto-layout yang di-drag untuk diubah urutan/parent-nya.
interface ReorderSession {
  id: string;
  start: WorldRect;
  element: Element | null;
  target: { parentId: string; index: number } | null;
}

/**
 * ED-024: selama drag hanya ada preview sementara (tanpa Yjs); saat dilepas, SATU transaksi dokumen
 * (= satu update Yjs & satu langkah undo); Esc/pointercancel membuang preview tanpa menyentuh dokumen.
 * Resize (8 handle, T0.6.3) memakai override style sementara; pindah memakai `translate` sementara (T0.6.2).
 */
export function useDragSessions(deps: DragSessionDeps): void {
  useEffect(() => {
    // Rect awal node diukur sekali saat drag dimulai, bukan di setiap pointermove (AC ED-019).
    let resizing: { nodeId: string; start: WorldRect; position: PositionStyle | undefined } | null = null;

    // ED-065: patch style hasil resize; dipakai sama persis untuk preview & commit.
    const resizePatchFor = (state: ResizeState) => {
      if (!resizing || resizing.nodeId !== state.nodeId) {
        const start = deps.geometry.getRect(state.nodeId);
        const node = deps.nodeStore.getNode(state.nodeId);
        resizing = start && node ? { nodeId: state.nodeId, start, position: resolveStyle(node.style, "base").position } : null;
      }
      if (!resizing) return null;
      const delta = screenDeltaToWorld(
        state.current.x - state.origin.x,
        state.current.y - state.origin.y,
        cameraStore.getState().zoom,
      );
      const next = resizeRect(resizing.start, state.handle, delta);
      return resizePatch(resizing.start, next, state.handle, resizing.position);
    };

    // ED-062 + ED-038: drag pada node terseleksi memindahkan seluruh seleksi; drag pada node lain memilihnya
    // dulu (aturan kedalaman ED-051) lalu memindahkannya. Hanya node absolute & tidak terkunci yang bergerak;
    // anak auto-layout memakai reorder (T0.6.5).
    const lookup = nodeLookupFrom(deps.nodeStore);
    let moving: MoveItem[] | null = null;

    let reordering: ReorderSession | null = null;

    const flexLayoutOf = (id: string) => {
      const node = deps.nodeStore.getNode(id);
      if (!node || !("children" in node)) return null;
      const layout = resolveStyle(node.style, "base").layout;
      return layout?.mode === "flex" ? { node, direction: layout.direction, wrap: layout.wrap === true } : null;
    };

    // Node yang di-drag: seluruh seleksi bila yang ditekan ada di dalamnya, atau node hasil aturan kedalaman.
    const draggedIds = (state: MoveState): readonly string[] => {
      const { selectedIds, select } = selectionStore.getState();
      if (state.path.some((id) => selectedIds.includes(id))) return selectedIds;
      const target = resolveClickSelection(state.path, selectedIds, lookup);
      const ids = target ? [target] : [];
      select(ids);
      return ids;
    };

    // ED-063: satu anak non-absolute di parent auto-layout → reorder (multi-seleksi reorder: P1).
    const beginReorder = (ids: readonly string[]): ReorderSession | null => {
      const [id] = ids;
      const node = id && ids.length === 1 ? deps.nodeStore.getNode(id) : null;
      if (!id || !node?.parentId || node.locked) return null;
      if (resolveStyle(node.style, "base").position?.type === "absolute" || !flexLayoutOf(node.parentId)) return null;
      const start = deps.geometry.getRect(id);
      if (!start) return null;
      const element = deps.geometry.getElement(id);
      // Node asli tetap di tempat, redup 40% (ED-063); dipulihkan di endReorder.
      if (element instanceof HTMLElement) element.style.opacity = "0.4";
      return { id, start, element, target: null };
    };

    // Container flex terdalam di bawah pointer yang bukan node yang di-drag atau turunannya. Section
    // (role DM-011) hanya bisa berada di page: section selebar page selalu "di dalam" section lain,
    // sehingga tanpa aturan ini section tidak pernah bisa diurutkan ulang (edge case ED-063).
    const dropTarget = (session: ReorderSession, state: MoveState) => {
      const hit = deps.hitTest(state.current.x, state.current.y);
      if (!hit) return null;
      const dragged = deps.nodeStore.getNode(session.id);
      const isSection = dragged?.type === "frame" && dragged.props.role === "section";
      const draggedIndex = hit.path.indexOf(session.id);
      const below = draggedIndex >= 0 ? hit.path.slice(draggedIndex + 1) : hit.path;
      const candidates = isSection ? below.filter((id) => deps.nodeStore.getNode(id)?.type === "page") : below;
      for (const containerId of candidates) {
        const flex = flexLayoutOf(containerId);
        if (flex) return { containerId, ...flex };
      }
      return null;
    };

    const updateReorder = (session: ReorderSession, state: MoveState) => {
      const delta = deltaFor(state);
      const ghost = { ...session.start, x: session.start.x + delta.dx, y: session.start.y + delta.dy };
      const target = dropTarget(session, state);
      const containerRect = target ? deps.geometry.peekRect(target.containerId) : null;
      if (!target || !containerRect) {
        session.target = null;
        previewStore.getState().setReorder({ ghost, marker: null });
        return;
      }
      const siblings: ChildBox[] = target.node.children
        .filter((childId) => childId !== session.id)
        .flatMap((childId) => {
          const rect = deps.geometry.peekRect(childId);
          return rect ? [{ id: childId, rect }] : [];
        });
      const pointer = screenToWorld(
        screenPoint(state.current.x, state.current.y),
        cameraStore.getState(),
        deps.viewportOffset(),
      );
      const index = reorderIndex(siblings, pointer, target.direction, target.wrap);
      session.target = { parentId: target.containerId, index };
      previewStore.getState().setReorder({
        ghost,
        marker: insertionMarker(siblings, index, target.direction, target.wrap, containerRect),
      });
    };

    const endReorder = () => {
      if (reordering?.element instanceof HTMLElement) reordering.element.style.removeProperty("opacity");
      reordering = null;
      previewStore.getState().setReorder(null);
    };

    const beginMove = (ids: readonly string[]): MoveItem[] => {
      return ids.flatMap((id) => {
        const node = deps.nodeStore.getNode(id);
        const position = node && !node.locked ? resolveStyle(node.style, "base").position : undefined;
        return position?.type === "absolute"
          ? [{ id, start: { x: position.x, y: position.y }, element: deps.geometry.getElement(id) }]
          : [];
      });
    };

    const deltaFor = (state: MoveState) => moveDelta(state.origin, state.current, cameraStore.getState().zoom, state.shiftKey);

    const endMove = () => {
      for (const item of moving ?? []) if (item.element) clearPreviewTranslate(item.element);
      moving = null;
      previewStore.getState().setOffset(null);
    };

    const unsubscribeState = interactionStore.subscribe(({ state }) => {
      if (state.type === "dragResize") {
        const patch = resizePatchFor(state);
        if (patch) previewStore.getState().setStyle(state.nodeId, patch);
      } else if (state.type === "dragMove") {
        if (!moving && !reordering) {
          const ids = draggedIds(state);
          reordering = beginReorder(ids);
          moving = reordering ? [] : beginMove(ids);
        }
        if (reordering) {
          updateReorder(reordering, state);
          return;
        }
        if (!moving || moving.length === 0) return;
        const { dx, dy } = deltaFor(state);
        for (const item of moving) if (item.element) setPreviewTranslate(item.element, dx, dy);
        previewStore.getState().setOffset({ ids: moving.map((item) => item.id), dx, dy });
      }
    });

    const unsubscribeEffects = interactionStore.getState().onEffect((effect) => {
      if (effect.type === "click") return;
      const { drag } = effect;

      if (drag.type === "dragMove" && reordering) {
        const { id, target } = reordering;
        const node = deps.nodeStore.getNode(id);
        const parent = node?.parentId ? deps.nodeStore.getNode(node.parentId) : null;
        // Indeks akhir moveNode = indeks semula bila parent sama → drop di tempat asal tidak membuat
        // update Yjs maupun langkah undo kosong.
        const unchanged =
          target?.parentId === node?.parentId && parent && "children" in parent && parent.children.indexOf(id) === target?.index;
        // Satu moveNode = satu transaksi (ED-024); indeks = posisi akhir di parent tujuan.
        if (effect.type === "commit" && target && !unchanged) {
          runOp(deps.opContext, moveNode, { id, newParentId: target.parentId, index: target.index });
        }
        endReorder();
        moving = null;
        return;
      }

      if (drag.type === "dragMove") {
        const items = moving ?? [];
        if (effect.type === "commit" && items.length > 0) {
          const delta = deltaFor(drag);
          // Semua node dalam SATU transaksi (= satu update Yjs & satu langkah undo, ED-024).
          deps.opContext.doc.transact(() => {
            for (const item of items) {
              runOp(deps.opContext, updateStyle, { ids: [item.id], patch: { position: movedPosition(item.start, delta) } });
            }
          }, deps.opContext.origin);
        }
        endMove();
        return;
      }

      if (drag.type !== "dragResize") return;
      const patch = effect.type === "commit" ? resizePatchFor(drag) : null;
      resizing = null;
      // Commit dulu, baru buang preview: keduanya di-batch React, jadi tidak ada kedipan ukuran lama.
      if (patch) runOp(deps.opContext, updateStyle, { ids: [drag.nodeId], patch });
      previewStore.getState().clear([drag.nodeId]);
    });

    return () => {
      unsubscribeState();
      unsubscribeEffects();
      endMove();
      endReorder();
    };
  }, [deps]);
}
