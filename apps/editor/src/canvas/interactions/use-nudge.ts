import {
  type CommandContext,
  reorderNode,
  resolveStyle,
  runCommand,
  UNDO_CAPTURE_TIMEOUT_MS,
  updateStyle,
} from "@platform/document-model";
import { useEffect } from "react";
import { isEditableEvent } from "../../commands/is-editable-target";
import { type Arrow, isArrow, nudgeOffset, reorderDirection } from "../../commands/nudge";
import { selectionStore } from "../../store/selection-store";
import type { CanvasRuntime } from "../canvas-runtime";
import { reorderStepIndex } from "../section-order";

// ED-064: panah = geser 1px, Shift+panah = big nudge (10px). Node absolute → ubah posisi; child auto-layout →
// reorder satu indeks (ED-063). Nudge beruntun (jeda < captureTimeout) digabung jadi satu langkah undo.
// TODO(ED-064): big nudge bisa diubah di Preferences (default 10).
const BIG_NUDGE = 10;

export function useNudge(runtime: CanvasRuntime): void {
  useEffect(() => {
    // Awal burst nudge baru (jeda ≥ captureTimeout sejak nudge terakhir) → buka batas undo agar burst tidak
    // tergabung dengan aksi sebelumnya (mis. pembuatan node). Nudge dalam burst yang sama digabung captureTimeout.
    let lastNudgeAt = Number.NEGATIVE_INFINITY;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!isArrow(event.key)) return;
      const ids = selectionStore.getState().selectedIds;
      if (ids.length === 0) return;
      event.preventDefault();

      const now = performance.now();
      if (now - lastNudgeAt >= UNDO_CAPTURE_TIMEOUT_MS) runtime.undo.stopCapturing();
      lastNudgeAt = now;

      const amount = event.shiftKey ? BIG_NUDGE : 1;
      const ctx: CommandContext = { doc: runtime.doc, origin: runtime.origin };
      // Multi-seleksi dalam satu transaksi (= satu langkah); keypress beruntun digabung captureTimeout.
      ctx.doc.transact(() => {
        for (const id of ids) nudgeNode(runtime, ctx, id, event.key as Arrow, amount);
      }, ctx.origin);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runtime]);
}

function nudgeNode(runtime: CanvasRuntime, ctx: CommandContext, id: string, arrow: Arrow, amount: number): void {
  const node = runtime.nodeStore.getNode(id);
  if (!node || node.locked) return;

  const position = resolveStyle(node.style, "base").position;
  if (position?.type === "absolute") {
    const offset = nudgeOffset(arrow, amount);
    const patch = offset.x !== 0 ? { x: position.x + offset.x } : { y: position.y + offset.y };
    runCommand(ctx, updateStyle, { ids: [id], patch: { position: patch } });
    return;
  }

  // Child flow di parent auto-layout → reorder satu indeks sesuai arah.
  const parent = node.parentId ? runtime.nodeStore.getNode(node.parentId) : null;
  if (!parent || !("children" in parent)) return;
  if (resolveStyle(parent.style, "base").layout?.mode !== "flex") return;
  const to = reorderStepIndex(parent.children.length, parent.children.indexOf(id), reorderDirection(arrow));
  if (to === null) return;
  runCommand(ctx, reorderNode, { id, index: to });
}
