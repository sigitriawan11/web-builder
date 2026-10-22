import { type RefObject, useEffect } from "react";
import { hitTestInstanceChild } from "../../canvas/hit-test/instance-child-hit";
import type { NodeStore } from "../../document/node-store";
import { childSelectionStore } from "../../store/child-selection-store";
import { interactionStore } from "../../store/interaction-store";
import { selectionStore } from "../../store/selection-store";
import { textEditingStore } from "../../store/text-editing-store";
import { effectiveTool, toolStore } from "../tool-store";
import { type MarqueeContext, marqueeSelection } from "./marquee-selection";
import { nodeLookupFrom } from "./node-lookup";
import { isEffectivelyLocked, resolveClickSelection, resolveDoubleClick } from "./selection-depth";

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
        // ED-059: marquee tidak memilih node terkunci.
        const hits = marqueeSelection(effect.drag, deps.marquee).filter((id) => !isEffectivelyLocked(id, lookup));
        select(effect.drag.additive ? [...selectedIds, ...hits.filter((id) => !selectedIds.includes(id))] : hits);
        return;
      }
      if (effect.type !== "click" || effect.target.kind === "handle") return;
      // ED-058: klik tunggal keluar dari mode "di dalam instance" (child override) → kembali ke seleksi node biasa.
      childSelectionStore.getState().clear();
      // ED-059: node terkunci (& turunannya) transparan terhadap klik canvas — jatuh ke ancestor/latar.
      const path = effect.target.path;
      const pageId = path.at(-1) ?? null;
      const visiblePath = path.filter((id) => !isEffectivelyLocked(id, lookup));
      // ED-054: Mod+klik = node terdalam (abaikan aturan kedalaman). Selain itu aturan kedalaman ED-051.
      const next =
        effect.deep && visiblePath.length > 0 && visiblePath[0] !== pageId
          ? (visiblePath[0] ?? null)
          : resolveClickSelection(visiblePath, selectedIds, lookup);
      // ED-052: Shift+klik = toggle di seleksi; tanpa Shift = ganti seleksi.
      if (effect.additive) {
        if (!next) return;
        select(selectedIds.includes(next) ? selectedIds.filter((id) => id !== next) : [...selectedIds, next]);
      } else if (next) {
        select([next]);
      } else {
        clear();
      }
    });

    const onDoubleClick = (event: MouseEvent) => {
      if (!isSelectTool()) return;
      const hit = hitTest(event.clientX, event.clientY);
      if (!hit) return;
      // ED-058/T3.6.3: double-click di dalam instance → masuk & pilih resolved child (override properti diizinkan).
      // Properti terstruktur/akses hardLocked ditangani Inspector (child override section).
      if (nodeStore.getNode(hit.nodeId)?.type === "instance") {
        const child = hitTestInstanceChild(event.clientX, event.clientY, hit.nodeId);
        if (child) {
          selectionStore.getState().select([hit.nodeId]);
          childSelectionStore.getState().select({ instanceId: hit.nodeId, ...child });
          return;
        }
      }
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
