import { type Node, resolveStyle, runCommand, updateStyle } from "@platform/document-model";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import { toggleAutoLayout } from "../../canvas/auto-layout/apply";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { autoLayoutHintStore } from "../../store/auto-layout-hint-store";

// ED-099: banner anjuran "pakai Auto layout" pada frame freeform lebar (≥ 376px), bisa di-dismiss per frame.
const MIN_WIDTH = 376;

export function AutoLayoutHint({
  runtime,
  nodes,
  readOnly,
}: {
  runtime: CanvasRuntime;
  nodes: readonly Node[];
  readOnly: boolean;
}) {
  const t = useT();
  const dismissed = useStore(autoLayoutHintStore, (state) => state.dismissed);

  const node = nodes.length === 1 ? nodes[0] : undefined;
  if (node?.type !== "frame" || readOnly) return null;
  // Hanya frame freeform (bukan auto-layout) yang belum di-dismiss.
  if (resolveStyle(node.style, "base").layout?.mode === "flex" || dismissed.has(node.id)) return null;
  const width = runtime.geometry.store.peekRect(node.id)?.width ?? 0;
  if (width < MIN_WIDTH) return null;

  const convert = () => {
    if (node.children.length > 0) {
      toggleAutoLayout(runtime, [node.id]);
    } else {
      runtime.undo.stopCapturing();
      runCommand(runtime.commandCtx, updateStyle, {
        ids: [node.id],
        patch: { layout: { mode: "flex", direction: "column" } },
      });
      runtime.undo.stopCapturing();
    }
  };

  return (
    <div className="m-3 rounded border border-border bg-muted/50 p-2 text-xs" data-testid="auto-layout-hint">
      <p className="text-muted-foreground">{t("inspector.autoLayoutHint")}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          data-testid="auto-layout-hint-convert"
          className="rounded bg-primary px-2 py-1 font-medium text-primary-foreground hover:opacity-90"
          onClick={convert}
        >
          {t("inspector.convert")}
        </button>
        <button
          type="button"
          data-testid="auto-layout-hint-dismiss"
          className="rounded px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => autoLayoutHintStore.getState().dismiss(node.id)}
        >
          {t("inspector.dismiss")}
        </button>
      </div>
    </div>
  );
}
