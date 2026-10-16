import { DOCUMENT_LIMITS } from "@platform/document-model";
import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@platform/ui";
import { ChevronUpIcon, CircleIcon, Grid3x3Icon, MinusIcon, PlusIcon } from "lucide-react";
import { type KeyboardEvent, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { zoomStep, zoomTo } from "../../canvas/camera-commands";
import { cameraStore } from "../../canvas/camera-store";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { zoomTo100, zoomToFit, zoomToSelection } from "../../canvas/fit-commands";
import type { ConnectionStatus } from "../../collaboration/document-session";
import { useNodes } from "../../document/use-node";
import { usePageNodeCount } from "../../document/use-page-node-count";
import { selectionStore } from "../../store/selection-store";
import { useT } from "../i18n";
import { formatShortcut, type Shortcut } from "./shortcut";
import { ToolbarButton } from "./ToolbarButton";
import { parseZoomInput } from "./zoom-input";

// ED-009: bar bawah 28 px — zoom (−, persentase bisa diketik, +, menu), info seleksi (tipe, nama, W×H), toggle layout
// grid (P1 M4 → nonaktif), jumlah node page vs batas (DM-076), indikator koneksi.

export const FIT: Shortcut = { code: "Digit1", shift: true };
export const ZOOM_SELECTION: Shortcut = { code: "Digit2", shift: true };
export const ZOOM_100_SHIFT: Shortcut = { code: "Digit0", shift: true };

function ZoomField() {
  const t = useT();
  const zoom = useStore(cameraStore, (state) => state.zoom);
  const percent = Math.round(zoom * 100);
  const [draft, setDraft] = useState<string | null>(null);
  // `draft` hanya ada selama mengetik; selain itu nilai mengikuti kamera.
  const commit = () => {
    const next = draft === null ? null : parseZoomInput(draft);
    if (next !== null) zoomTo(next);
    setDraft(null);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commit();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(null);
      event.currentTarget.blur();
    }
  };
  return (
    <input
      aria-label={t("bottomBar.zoomInput")}
      data-testid="zoom-input"
      className="h-5 w-12 rounded border-transparent bg-transparent text-center text-xs tabular-nums hover:border-border focus:border-ring focus:outline-none"
      value={draft ?? `${percent}%`}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

function SelectionInfo({ runtime }: { runtime: CanvasRuntime }) {
  const t = useT();
  const selectedIds = useStore(selectionStore, (state) => state.selectedIds);
  const nodes = useNodes(selectedIds);
  // Ukuran dari geometri terukur (berubah tanpa transaksi dokumen saat layout berubah).
  const firstId = selectedIds.length === 1 ? (selectedIds[0] ?? null) : null;
  const subscribe = (listener: () => void) =>
    firstId ? runtime.geometry.store.subscribe(firstId, listener) : () => {};
  const rect = useSyncExternalStore(subscribe, () => (firstId ? runtime.geometry.store.peekRect(firstId) : null));
  if (nodes.length === 0) return <span className="text-muted-foreground">{t("bottomBar.noSelection")}</span>;
  if (nodes.length > 1) return <span>{t("bottomBar.selected", { count: nodes.length })}</span>;
  const node = nodes[0];
  if (!node) return null;
  return (
    <span className="flex min-w-0 items-center gap-2" data-testid="selection-info">
      <span className="text-muted-foreground">{t(`nodeType.${node.type}`)}</span>
      <span className="truncate">{node.name}</span>
      {rect ? (
        <span className="tabular-nums text-muted-foreground" data-testid="selection-size">
          {Math.round(rect.width)} × {Math.round(rect.height)}
        </span>
      ) : null}
    </span>
  );
}

export function BottomBar({ runtime, connection }: { runtime: CanvasRuntime; connection: ConnectionStatus }) {
  const t = useT();
  const nodeCount = usePageNodeCount(runtime.doc, runtime.nodeStore, runtime.pageId);
  const { soft, hard } = DOCUMENT_LIMITS.nodesPerPage;
  const online = connection === "synced";
  return (
    <section
      className="flex h-7 shrink-0 items-center gap-2 border-t bg-background px-2 text-xs"
      data-testid="bottom-bar"
      aria-label={t("bottomBar.label")}
    >
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          label={t("toolbar.zoomOut")}
          shortcut={{ code: "Minus", mod: true }}
          icon={<MinusIcon />}
          className="size-5"
          data-testid="zoom-out"
          onClick={() => zoomStep("out")}
        />
        <ZoomField />
        <ToolbarButton
          label={t("toolbar.zoomIn")}
          shortcut={{ code: "Equal", mod: true }}
          icon={<PlusIcon />}
          className="size-5"
          data-testid="zoom-in"
          onClick={() => zoomStep("in")}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarButton
              label={t("bottomBar.zoomMenu")}
              icon={<ChevronUpIcon />}
              className="size-5"
              data-testid="zoom-menu"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem onSelect={() => zoomToFit(runtime)}>
              {t("bottomBar.zoomFit")}
              <DropdownMenuShortcut>{formatShortcut(FIT)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomToSelection(runtime)}>
              {t("bottomBar.zoomSelection")}
              <DropdownMenuShortcut>{formatShortcut(ZOOM_SELECTION)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => zoomTo(0.5)}>{t("toolbar.zoomPreset", { percent: 50 })}</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomTo100()}>
              {t("toolbar.zoomPreset", { percent: 100 })}
              <DropdownMenuShortcut>{formatShortcut(ZOOM_100_SHIFT)}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => zoomTo(2)}>{t("toolbar.zoomPreset", { percent: 200 })}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mx-1 h-4 w-px bg-border" />
      <div className="flex min-w-0 flex-1 items-center">
        <SelectionInfo runtime={runtime} />
      </div>
      <ToolbarButton
        label={t("bottomBar.layoutGrid")}
        icon={<Grid3x3Icon />}
        className="size-5"
        disabled
        data-testid="layout-grid-toggle"
      />
      <span
        className={cn(
          "tabular-nums",
          nodeCount > soft ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground",
        )}
        data-testid="node-count"
        title={t("bottomBar.nodeLimit", { soft, hard })}
      >
        {t("bottomBar.nodes", { count: nodeCount, max: soft })}
      </span>
      <span
        className="flex items-center gap-1 text-muted-foreground"
        data-testid="connection-indicator"
        data-online={online}
      >
        <CircleIcon
          className={cn("size-2", online ? "fill-emerald-500 text-emerald-500" : "fill-amber-500 text-amber-500")}
        />
        {online ? t("bottomBar.online") : t("bottomBar.offline")}
      </span>
    </section>
  );
}
