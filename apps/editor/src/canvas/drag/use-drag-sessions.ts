import { type OpContext, type PositionStyle, resolveStyle, runOp, updateStyle } from "@platform/document-model";
import { useEffect } from "react";
import type { NodeStore } from "../../document/node-store";
import { interactionStore } from "../../store/interaction-store";
import { previewStore } from "../../store/preview-store";
import { selectionStore } from "../../store/selection-store";
import { nodeLookupFrom } from "../../tools/select/node-lookup";
import { resolveClickSelection } from "../../tools/select/selection-depth";
import { cameraStore } from "../camera-store";
import { screenDeltaToWorld } from "../geometry/coordinates";
import type { GeometryStore, WorldRect } from "../geometry/geometry-store";
import type { InteractionState } from "../interactions/interaction-machine";
import { moveDelta, movedPosition } from "./move";
import { resizePatch, resizeRect } from "./resize";
import { clearPreviewTranslate, setPreviewTranslate } from "./transform-preview";

export interface DragSessionDeps {
  // Konteks op dengan origin lokal: commit masuk UndoManager sebagai satu langkah.
  opContext: OpContext;
  geometry: GeometryStore;
  nodeStore: NodeStore;
}

type ResizeState = Extract<InteractionState, { type: "dragResize" }>;
type MoveState = Extract<InteractionState, { type: "dragMove" }>;

interface MoveItem {
  id: string;
  start: { x: number; y: number };
  element: Element | null;
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

    const beginMove = (state: MoveState): MoveItem[] => {
      const { selectedIds, select } = selectionStore.getState();
      let ids: readonly string[] = selectedIds;
      if (!state.path.some((id) => selectedIds.includes(id))) {
        const target = resolveClickSelection(state.path, selectedIds, lookup);
        ids = target ? [target] : [];
        select(ids);
      }
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
        moving ??= beginMove(state);
        if (moving.length === 0) return;
        const { dx, dy } = deltaFor(state);
        for (const item of moving) if (item.element) setPreviewTranslate(item.element, dx, dy);
        previewStore.getState().setOffset({ ids: moving.map((item) => item.id), dx, dy });
      }
    });

    const unsubscribeEffects = interactionStore.getState().onEffect((effect) => {
      if (effect.type === "click") return;
      const { drag } = effect;

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
    };
  }, [deps]);
}
