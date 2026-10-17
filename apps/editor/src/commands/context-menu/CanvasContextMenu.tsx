import { translate } from "@platform/i18n";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@platform/ui";
import type { CSSProperties, ReactNode } from "react";
import { useStore } from "zustand";
import { formatShortcut } from "../../app/chrome/shortcut";
import { useLocale } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { copy, cut, duplicate, paste } from "../../canvas/interactions/use-clipboard-shortcuts";
import { selectionStore } from "../../store/selection-store";
import { type NodeLookup, resolveClickSelection } from "../../tools/select/selection-depth";
import { PALETTE_ACTIONS } from "../palette/actions";
import { bindingById, primaryShortcut } from "../shortcut-registry";

// ED-206: context menu klik kanan di canvas. Item disusun sesuai seleksi; shortcut dari registry (satu sumber).
// Klik kanan pada node yang belum terpilih → pilih dulu (aturan hit-test). Area kosong → menu aksi kanvas.

const ACTION_RUN: Record<string, (runtime: CanvasRuntime) => void> = Object.fromEntries(
  PALETTE_ACTIONS.map((action) => [action.id, action.run]),
);

interface MenuEntry {
  key: string;
  run(runtime: CanvasRuntime): void;
  labelKey: string;
  shortcutId?: string;
  variant?: "destructive";
}

// Item yang labelnya = judul command registry (plus shortcut-nya).
const cmd = (id: string, run: (r: CanvasRuntime) => void, variant?: "destructive"): MenuEntry => ({
  key: id,
  run,
  labelKey: bindingById(id)?.titleKey ?? id,
  shortcutId: id,
  ...(variant ? { variant } : {}),
});

const SELECTION_GROUPS: MenuEntry[][] = [
  [
    cmd("edit.copy", (r) => void copy(r)),
    cmd("edit.cut", (r) => cut(r)),
    cmd("edit.paste", (r) => void paste(r, false)),
    cmd("edit.duplicate", (r) => duplicate(r)),
  ],
  [
    cmd("arrange.front", (r) => ACTION_RUN["arrange.front"]?.(r)),
    cmd("arrange.forward", (r) => ACTION_RUN["arrange.forward"]?.(r)),
    cmd("arrange.backward", (r) => ACTION_RUN["arrange.backward"]?.(r)),
    cmd("arrange.back", (r) => ACTION_RUN["arrange.back"]?.(r)),
  ],
  [
    cmd("edit.lock", (r) => ACTION_RUN["edit.lock"]?.(r)),
    cmd("edit.hide", (r) => ACTION_RUN["edit.hide"]?.(r)),
    cmd("node.addLink", (r) => ACTION_RUN["node.addLink"]?.(r)),
  ],
  [cmd("edit.delete", (r) => ACTION_RUN["edit.delete"]?.(r), "destructive")],
];

const EMPTY_GROUP: MenuEntry[] = [
  cmd("edit.paste", (r) => void paste(r, false)),
  cmd("zoom.fit", (r) => ACTION_RUN["zoom.fit"]?.(r)),
  cmd("zoom.100", (r) => ACTION_RUN["zoom.100"]?.(r)),
];

export function CanvasContextMenu({
  runtime,
  className,
  style,
  children,
}: {
  runtime: CanvasRuntime;
  className?: string;
  // Playground tanpa Tailwind memakai `style={{display:"contents"}}` (netral layout); SiteEditor memakai className.
  style?: CSSProperties;
  children: ReactNode;
}) {
  const locale = useLocale();
  const selectedIds = useStore(selectionStore, (state) => state.selectedIds);

  // Klik kanan: pilih node di bawah kursor (aturan kedalaman sama seperti klik kiri, ED-051) bila belum terpilih;
  // area kosong → kosongkan seleksi (menu kanvas).
  const lookup: NodeLookup = (id) => {
    const node = runtime.nodeStore.getNode(id);
    if (!node) return null;
    return {
      type: node.type,
      parentId: node.parentId,
      role: node.type === "frame" ? node.props.role : undefined,
      locked: node.locked,
    };
  };
  const onContextMenu = (event: { clientX: number; clientY: number }) => {
    const hit = runtime.hitTest(event.clientX, event.clientY);
    const current = selectionStore.getState().selectedIds;
    const nodeId = hit ? resolveClickSelection(hit.path, current, lookup) : null;
    if (nodeId) {
      if (!current.includes(nodeId)) selectionStore.getState().select([nodeId]);
    } else {
      selectionStore.getState().clear();
    }
  };

  const groups = selectedIds.length > 0 ? SELECTION_GROUPS : [EMPTY_GROUP];
  const label = (entry: MenuEntry) => translate(locale, "editor", entry.labelKey);
  const shortcut = (entry: MenuEntry) => {
    const key = entry.shortcutId ? primaryShortcut(entry.shortcutId) : undefined;
    return key ? formatShortcut(key) : null;
  };

  return (
    <ContextMenu>
      {/* asChild: trigger = kontainer canvas (tanpa menambah level layout). */}
      <ContextMenuTrigger asChild>
        <div className={className} style={style} data-testid="editor-canvas" onContextMenuCapture={onContextMenu}>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent data-testid="canvas-context-menu">
        {groups.flatMap((group, groupIndex) => [
          groupIndex > 0 ? <ContextMenuSeparator key={`sep-${group[0]?.key}`} /> : null,
          ...group.map((entry) => (
            <ContextMenuItem
              key={entry.key}
              data-testid={`ctx-${entry.key}`}
              {...(entry.variant ? { variant: entry.variant } : {})}
              onSelect={() => entry.run(runtime)}
            >
              {label(entry)}
              {shortcut(entry) ? <ContextMenuShortcut>{shortcut(entry)}</ContextMenuShortcut> : null}
            </ContextMenuItem>
          )),
        ])}
      </ContextMenuContent>
    </ContextMenu>
  );
}
