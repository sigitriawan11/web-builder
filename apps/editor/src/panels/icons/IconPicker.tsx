import { createNode, runCommand } from "@platform/document-model";
import { cn, Input } from "@platform/ui";
import { icons } from "lucide-react";
import { createElement, useDeferredValue, useMemo, useState } from "react";
import { useT } from "../../app/i18n";
import { cameraStore } from "../../canvas/camera-store";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { screenPoint, screenToWorld } from "../../canvas/geometry/coordinates";
import { kebabToPascal, searchIcons } from "../../canvas/render-root/lucide-icon";
import { selectionStore } from "../../store/selection-store";
import { toolStore } from "../../tools/tool-store";

const ICON_SIZE = 24;

// ED-037: posisi absolute untuk ikon di parent freeform — ditaruh di tengah viewport (lokal parent), di-clamp ke
// dalam parent bila sudah terukur. Tanpa ini ikon jadi flow child di parent non-flex → tidak bisa digeser (hanya
// resize), karena drag-move butuh `position.absolute` dan reorder butuh parent auto-layout.
function freeformPosition(runtime: CanvasRuntime, parentId: string): { type: "absolute"; x: number; y: number } {
  const viewport = document.getElementById("editor-viewport")?.getBoundingClientRect();
  const offset = { left: viewport?.left ?? 0, top: viewport?.top ?? 0 };
  const center = screenPoint(offset.left + (viewport?.width ?? 0) / 2, offset.top + (viewport?.height ?? 0) / 2);
  const world = screenToWorld(center, cameraStore.getState(), offset);
  const parentRect = runtime.geometry.store.getRect(parentId);
  let x = Math.round(world.x - (parentRect?.x ?? 0) - ICON_SIZE / 2);
  let y = Math.round(world.y - (parentRect?.y ?? 0) - ICON_SIZE / 2);
  if (parentRect) {
    x = Math.max(0, Math.min(x, Math.round(parentRect.width) - ICON_SIZE));
    y = Math.max(0, Math.min(y, Math.round(parentRect.height) - ICON_SIZE));
  }
  return { type: "absolute", x, y };
}

// ED-046: picker ikon Lucide (search). Pilih → sisip node `icon` di dalam frame/page terpilih, lalu kembali ke Move.
// ED-037: parent freeform → ikon absolute (bisa digeser); parent auto-layout → flow (pindah via reorder).
function insertIcon(runtime: CanvasRuntime, name: string): void {
  const selected = selectionStore.getState().selectedIds[0];
  const selectedNode = selected ? runtime.nodeStore.getNode(selected) : null;
  // Parent = frame terpilih, atau page aktif.
  const parentId =
    selectedNode && (selectedNode.type === "frame" || selectedNode.type === "page") ? selectedNode.id : runtime.pageId;
  const parent = runtime.nodeStore.getNode(parentId);
  const parentIsFlow = parent?.style.base?.layout?.mode === "flex";
  const size = {
    width: { mode: "fixed" as const, value: ICON_SIZE, unit: "px" as const },
    height: { mode: "fixed" as const, value: ICON_SIZE, unit: "px" as const },
  };
  const base = parentIsFlow ? { size } : { size, position: freeformPosition(runtime, parentId) };
  runtime.undo.stopCapturing();
  const result = runCommand({ doc: runtime.doc, origin: runtime.origin }, createNode, {
    parentId,
    type: "icon",
    props: { set: "lucide", name },
    style: { base },
  });
  if (result.ok) selectionStore.getState().select([result.value]);
  toolStore.getState().dispatch({ type: "selectTool", tool: "select" });
}

export function IconPicker({ runtime, onClose }: { runtime: CanvasRuntime; onClose: () => void }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const results = useMemo(() => searchIcons(deferred, 60), [deferred]);
  return (
    <div className="flex w-64 flex-col gap-2 p-2" data-testid="icon-picker">
      <Input
        type="search"
        placeholder={t("icons.search")}
        aria-label={t("icons.search")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="h-8"
        data-testid="icon-search"
      />
      <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto" role="listbox" aria-label={t("icons.results")}>
        {results.map((name) => {
          const Icon = (icons as Record<string, React.ComponentType<{ className?: string }>>)[kebabToPascal(name)];
          return (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={false}
              aria-label={name}
              title={name}
              data-testid={`icon-option-${name}`}
              className={cn("flex size-8 items-center justify-center rounded hover:bg-accent")}
              onClick={() => {
                insertIcon(runtime, name);
                onClose();
              }}
            >
              {Icon ? createElement(Icon, { className: "size-4" }) : null}
            </button>
          );
        })}
        {results.length === 0 ? (
          <p className="col-span-6 p-2 text-xs text-muted-foreground">{t("icons.empty")}</p>
        ) : null}
      </div>
    </div>
  );
}
