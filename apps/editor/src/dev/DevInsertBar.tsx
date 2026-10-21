import { createNode, runCommand } from "@platform/document-model";
import { Button } from "@platform/ui";
import { ImageIcon, SquareIcon, TypeIcon } from "lucide-react";
import { useT } from "../app/i18n";
import type { CanvasRuntime } from "../canvas/canvas-runtime";
import { selectionStore } from "../store/selection-store";
import { recordEditorAction } from "../telemetry/telemetry";
import { type DevInsertKind, devInsertInput, firstImageAsset } from "./dev-insert";

// Tampil di build dev, atau bila `VITE_EDITOR_DEV_TOOLS=true` (mis. staging) — tidak untuk user production.
export const devToolsEnabled = () => import.meta.env.DEV || import.meta.env.VITE_EDITOR_DEV_TOOLS === "true";

const ITEMS = [
  { kind: "frame", icon: SquareIcon },
  { kind: "text", icon: TypeIcon },
  { kind: "image", icon: ImageIcon },
] as const;

export function DevInsertBar({ runtime, readOnly }: { runtime: CanvasRuntime; readOnly: boolean }) {
  const t = useT();
  const imageAssetId = firstImageAsset(runtime.doc);

  const insert = (kind: DevInsertKind) => {
    const input = devInsertInput(
      kind,
      {
        pageId: runtime.pageId,
        selectedIds: selectionStore.getState().selectedIds,
        getNode: runtime.nodeStore.getNode,
        imageAssetId,
      },
      t("devTools.newText"),
    );
    if (!input) return;
    recordEditorAction(`devInsert:${kind}`);
    runtime.undo.stopCapturing();
    const result = runCommand(runtime.commandCtx, createNode, input);
    // ED-037: node baru langsung terseleksi.
    if (result.ok) selectionStore.getState().select([String(result.value)]);
    else console.error("editor: tombol dev gagal membuat node", result);
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: grup tombol toolbar sementara, bukan fieldset form.
    <div role="group" aria-label={t("devTools.label")} className="flex items-center gap-1" data-testid="dev-insert-bar">
      {ITEMS.map(({ kind, icon: Icon }) => {
        const unavailable = kind === "image" && !imageAssetId;
        const label = unavailable ? t("devTools.imageUnavailable") : t(`devTools.${kind}`);
        return (
          <Button
            key={kind}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t(`devTools.${kind}`)}
            title={label}
            disabled={readOnly || unavailable}
            onClick={() => insert(kind)}
            data-testid={`dev-insert-${kind}`}
          >
            <Icon />
          </Button>
        );
      })}
    </div>
  );
}
