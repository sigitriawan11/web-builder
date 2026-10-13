import { type RefObject, useEffect } from "react";
import type { NodeStore } from "../../document/node-store";
import { interactionStore } from "../../store/interaction-store";
import { selectionStore } from "../../store/selection-store";
import { textEditingStore } from "../../store/text-editing-store";
import { effectiveTool, toolStore } from "../tool-store";
import { type MarqueeContext, marqueeSelection } from "./marquee-selection";
import { nodeLookupFrom } from "./node-lookup";
import { resolveClickSelection, resolveDoubleClick } from "./selection-depth";

export interface SelectToolDeps {
  nodeStore: NodeStore;
  hitTest(clientX: number, clientY: number): { nodeId: string; path: readonly string[] } | null;
  marquee: MarqueeContext;
}

/**
 * Move/Select tool (ED-038): klik memilih dengan aturan kedalaman (ED-051), klik di area kosong
 * mengosongkan seleksi, double-click masuk ke anak atau mengedit teks yang sudah terseleksi,
 * marquee memilih node yang tersentuh (ED-053; Shift menambah).
 * Klik datang dari efek `click` state machine interaksi (T0.5.3); hand tool tidak menghasilkan klik.
 */
export function useSelectTool(viewportRef: RefObject<HTMLElement | null>, deps: SelectToolDeps): void {
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { nodeStore, hitTest } = deps;
    const lookup = nodeLookupFrom(nodeStore);
    const isSelectTool = () => effectiveTool(toolStore.getState()) === "select";

    const unsubscribe = interactionStore.getState().onEffect((effect) => {
      if (!isSelectTool()) return;
      const { selectedIds, select, clear } = selectionStore.getState();

      if (effect.type === "commit" && effect.drag.type === "marquee") {
        const hits = marqueeSelection(effect.drag, deps.marquee);
        select(effect.drag.additive ? [...selectedIds, ...hits.filter((id) => !selectedIds.includes(id))] : hits);
        return;
      }
      if (effect.type !== "click" || effect.target.kind === "handle") return;
      // Latar frame yang dimasuki tetap membawa path, sehingga klik di sana memilih frame itu (ED-051).
      const next = resolveClickSelection(effect.target.path, selectedIds, lookup);
      if (next) select([next]);
      else clear();
    });

    const onDoubleClick = (event: MouseEvent) => {
      if (!isSelectTool()) return;
      const hit = hitTest(event.clientX, event.clientY);
      if (!hit) return;
      const action = resolveDoubleClick(hit.path, selectionStore.getState().selectedIds, lookup);
      if (action.type === "select") selectionStore.getState().select([action.nodeId]);
      else if (action.type === "editText") textEditingStore.getState().startEditing(action.nodeId);
    };

    viewport.addEventListener("dblclick", onDoubleClick);
    return () => {
      unsubscribe();
      viewport.removeEventListener("dblclick", onDoubleClick);
    };
  }, [viewportRef, deps]);
}
