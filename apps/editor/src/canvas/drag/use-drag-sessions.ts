import { type OpContext, runOp, updateStyle } from "@platform/document-model";
import { useEffect } from "react";
import { interactionStore } from "../../store/interaction-store";
import { previewStore } from "../../store/preview-store";
import { cameraStore } from "../camera-store";
import { screenDeltaToWorld } from "../geometry/coordinates";
import type { GeometryStore, WorldRect } from "../geometry/geometry-store";
import type { InteractionState } from "../interactions/interaction-machine";
import { fixedSizePatch, resizedSize } from "./resize-preview";

export interface DragSessionDeps {
  // Konteks op dengan origin lokal: commit masuk UndoManager sebagai satu langkah.
  opContext: OpContext;
  geometry: GeometryStore;
}

type ResizeState = Extract<InteractionState, { type: "dragResize" }>;

/**
 * ED-024: selama drag hanya ada preview sementara (tanpa Yjs); saat dilepas, SATU transaksi dokumen
 * (= satu update Yjs & satu langkah undo); Esc/pointercancel membuang preview tanpa menyentuh dokumen.
 * T0.6.1: resize (override style sementara). Pindah (transform sementara) menyusul di T0.6.2.
 */
export function useDragSessions(deps: DragSessionDeps): void {
  useEffect(() => {
    // Rect awal node diukur sekali saat drag dimulai, bukan di setiap pointermove (AC ED-019).
    let session: { nodeId: string; start: WorldRect } | null = null;

    const sizeFor = (state: ResizeState) => {
      if (!session || session.nodeId !== state.nodeId) {
        const start = deps.geometry.getRect(state.nodeId);
        session = start ? { nodeId: state.nodeId, start } : null;
      }
      if (!session) return null;
      const delta = screenDeltaToWorld(
        state.current.x - state.origin.x,
        state.current.y - state.origin.y,
        cameraStore.getState().zoom,
      );
      return resizedSize(session.start, state.handle, delta);
    };

    const unsubscribeState = interactionStore.subscribe(({ state }) => {
      if (state.type !== "dragResize") return;
      const size = sizeFor(state);
      if (size) previewStore.getState().setStyle(state.nodeId, fixedSizePatch(size));
    });

    const unsubscribeEffects = interactionStore.getState().onEffect((effect) => {
      if (effect.type === "click" || effect.drag.type !== "dragResize") return;
      const { drag } = effect;
      const size = effect.type === "commit" ? sizeFor(drag) : null;
      session = null;
      // Commit dulu, baru buang preview: keduanya di-batch React, jadi tidak ada kedipan ukuran lama.
      if (size) runOp(deps.opContext, updateStyle, { ids: [drag.nodeId], patch: fixedSizePatch(size) });
      previewStore.getState().clear([drag.nodeId]);
    });

    return () => {
      unsubscribeState();
      unsubscribeEffects();
    };
  }, [deps]);
}
