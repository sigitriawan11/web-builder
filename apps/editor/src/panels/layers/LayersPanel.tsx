import { moveNode, type Node, renameNode, runCommand, setLocked, setVisible } from "@platform/document-model";
import { cn } from "@platform/ui";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  FrameIcon,
  ImageIcon,
  LockIcon,
  LockOpenIcon,
  type LucideIcon,
  SmileIcon,
  SquareIcon,
  StickyNoteIcon,
  TypeIcon,
} from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type NodeRendererProps, Tree, type TreeApi } from "react-arborist";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { docDropIndex, type LayerNode, useLayerTree } from "../../document/use-layer-tree";
import { selectionStore } from "../../store/selection-store";

// ED-141: ikon per tipe node.
const TYPE_ICON: Record<Node["type"], LucideIcon> = {
  page: StickyNoteIcon,
  frame: FrameIcon,
  text: TypeIcon,
  image: ImageIcon,
  shape: SquareIcon,
  icon: SmileIcon,
};

interface LayerActions {
  runtime: CanvasRuntime;
  readOnly: boolean;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  // ED-143: klik dengan modifier — Shift = rentang, Mod = toggle, selain itu seleksi tunggal.
  onRowClick: (id: string, event: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  // ED-140: Alt+klik toggle = rekursif (buka/tutup seluruh subtree).
  recursiveToggle: (data: LayerNode, open: boolean) => void;
}
const LayerActionsContext = createContext<LayerActions | null>(null);

function flattenIds(nodes: readonly LayerNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    out.push(node.id);
    if (node.children) flattenIds(node.children, out);
  }
  return out;
}

function containerIds(node: LayerNode, out: string[] = []): string[] {
  if (node.children) {
    out.push(node.id);
    for (const child of node.children) containerIds(child, out);
  }
  return out;
}

// ED-136: tree layers virtualized (react-arborist). Seleksi ikut store seleksi canvas (dua arah).
export function LayersPanel({
  runtime,
  pageId,
  readOnly,
}: {
  runtime: CanvasRuntime;
  pageId: string;
  readOnly: boolean;
}) {
  const tree = useLayerTree(runtime.doc, runtime.nodeStore, pageId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const treeRef = useRef<TreeApi<LayerNode> | null>(null);
  const flatIds = useMemo(() => flattenIds(tree), [tree]);
  const recursiveToggle = (data: LayerNode, open: boolean) => {
    const api = treeRef.current;
    if (!api) return;
    for (const id of containerIds(data)) (open ? api.open : api.close).call(api, id);
  };
  // ED-138: drag reorder/reparent. react-arborist index = urutan tampilan (Figma); dikonversi ke index dokumen.
  // Node yang ditarik di-reparent lewat moveNode (validasi cycle/limit di command); drop hanya ke container.
  const handleMove = ({ dragIds, parentId, index }: { dragIds: string[]; parentId: string | null; index: number }) => {
    if (readOnly || dragIds.length === 0) return;
    const targetParentId = parentId ?? pageId;
    const parent = runtime.nodeStore.getNode(targetParentId);
    if (!parent || !("children" in parent)) return;
    const remaining = parent.children.filter((id) => !dragIds.includes(id));
    const base = docDropIndex(remaining.length, index);
    runtime.undo.stopCapturing();
    runtime.doc.transact(() => {
      const ctx = { doc: runtime.doc, origin: runtime.origin };
      const parentRect = runtime.geometry.store.peekRect(targetParentId);
      // Urutan dokumen node yang ditarik = kebalikan urutan tampilan.
      [...dragIds].reverse().forEach((id, offset) => {
        const rect = runtime.geometry.store.peekRect(id);
        const measured =
          rect && parentRect
            ? { node: { x: rect.x, y: rect.y }, newParent: { x: parentRect.x, y: parentRect.y } }
            : undefined;
        runCommand(ctx, moveNode, {
          id,
          newParentId: targetParentId,
          index: base + offset,
          keepVisualPosition: true,
          ...(measured ? { measured } : {}),
        });
      });
    }, runtime.origin);
    runtime.undo.stopCapturing();
  };

  // ED-140: buka otomatis ke node terseleksi (buka semua ancestornya).
  useEffect(() => {
    const expand = (ids: readonly string[]) => {
      for (const id of ids) treeRef.current?.openParents(id);
    };
    expand(selectionStore.getState().selectedIds);
    return selectionStore.subscribe((state) => expand(state.selectedIds));
  }, []);
  const onRowClick: LayerActions["onRowClick"] = (id, event) => {
    const store = selectionStore.getState();
    const anchor = store.anchorId;
    if (event.shiftKey && anchor) {
      const a = flatIds.indexOf(anchor);
      const b = flatIds.indexOf(id);
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        store.select(flatIds.slice(lo, hi + 1));
        return;
      }
    }
    if (event.metaKey || event.ctrlKey) {
      const current = store.selectedIds;
      store.select(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
      return;
    }
    store.select([id]);
  };
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  return (
    <LayerActionsContext.Provider value={{ runtime, readOnly, editingId, setEditingId, onRowClick, recursiveToggle }}>
      <div ref={containerRef} className="min-h-0 flex-1" data-testid="layers-tree">
        {size.height > 0 ? (
          <Tree<LayerNode>
            ref={treeRef}
            data={tree}
            width={size.width}
            height={size.height}
            rowHeight={24}
            indent={12}
            openByDefault
            disableMultiSelection
            onMove={handleMove}
          >
            {LayerRow}
          </Tree>
        ) : null}
      </div>
    </LayerActionsContext.Provider>
  );
}

function LayerRow({ node, style, dragHandle }: NodeRendererProps<LayerNode>) {
  const t = useT();
  const actions = useContext(LayerActionsContext);
  const selectedIds = useStore(selectionStore, (state) => state.selectedIds);
  const selected = selectedIds.includes(node.id);
  const { type, name: rawName, visible, locked } = node.data;
  const Icon = TYPE_ICON[type];
  const name = rawName || t(`nodeType.${type}`);
  const editing = actions?.editingId === node.id;

  const withUndo = (fn: (ctx: { doc: CanvasRuntime["doc"]; origin: CanvasRuntime["origin"] }) => void) => {
    if (!actions || actions.readOnly) return;
    const { runtime } = actions;
    runtime.undo.stopCapturing();
    fn({ doc: runtime.doc, origin: runtime.origin });
    runtime.undo.stopCapturing();
  };
  const commitRename = (value: string) => {
    const next = value.trim();
    if (next && next !== rawName) withUndo((ctx) => runCommand(ctx, renameNode, { id: node.id, name: next }));
    actions?.setEditingId(null);
  };

  return (
    <div
      ref={dragHandle}
      style={style}
      role="treeitem"
      aria-selected={selected}
      aria-expanded={node.isInternal ? node.isOpen : undefined}
      tabIndex={-1}
      data-testid={`layer-${node.id}`}
      onClick={(event) =>
        actions?.onRowClick(node.id, { shiftKey: event.shiftKey, metaKey: event.metaKey, ctrlKey: event.ctrlKey })
      }
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectionStore.getState().select([node.id]);
        } else if (event.key === "F2" && !actions?.readOnly) {
          event.preventDefault();
          actions?.setEditingId(node.id);
        }
      }}
      className={cn(
        "group flex h-6 cursor-default items-center gap-1 rounded px-1 text-xs",
        selected ? "bg-accent text-foreground" : "hover:bg-accent/50",
        !visible && "opacity-40",
      )}
    >
      <span style={{ paddingLeft: node.level * 12 }} className="flex items-center gap-1">
        {node.isInternal ? (
          <button
            type="button"
            aria-label={node.isOpen ? t("layers.collapse") : t("layers.expand")}
            data-testid={`layer-toggle-${node.id}`}
            onClick={(event) => {
              event.stopPropagation();
              if (event.altKey) actions?.recursiveToggle(node.data, !node.isOpen);
              else node.toggle();
            }}
            className="flex size-3.5 items-center justify-center text-muted-foreground"
          >
            {node.isOpen ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
          </button>
        ) : (
          <span className="size-3.5" />
        )}
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      </span>
      {editing ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: edit nama dimulai eksplisit (dbl-click/F2) → fokus wajar.
          autoFocus
          defaultValue={rawName}
          aria-label={t("layers.rename")}
          data-testid={`layer-name-input-${node.id}`}
          className="h-5 min-w-0 flex-1 rounded border border-ring bg-background px-1 text-xs"
          onClick={(event) => event.stopPropagation()}
          onBlur={(event) => commitRename(event.currentTarget.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") commitRename(event.currentTarget.value);
            else if (event.key === "Escape") actions?.setEditingId(null);
          }}
        />
      ) : (
        // biome-ignore lint/a11y/noStaticElementInteractions: dbl-click rename; aksi utama (select/F2) ada di baris.
        <span className="flex-1 truncate" onDoubleClick={() => !actions?.readOnly && actions?.setEditingId(node.id)}>
          {name}
        </span>
      )}
      {!editing && !actions?.readOnly ? (
        <>
          <button
            type="button"
            aria-label={locked ? t("layers.unlock") : t("layers.lock")}
            data-testid={`layer-lock-${node.id}`}
            onClick={(event) => {
              event.stopPropagation();
              withUndo((ctx) => runCommand(ctx, setLocked, { ids: [node.id], locked: !locked }));
            }}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              locked ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            {locked ? <LockIcon className="size-3" /> : <LockOpenIcon className="size-3" />}
          </button>
          <button
            type="button"
            aria-label={visible ? t("layers.hide") : t("layers.show")}
            data-testid={`layer-visible-${node.id}`}
            onClick={(event) => {
              event.stopPropagation();
              withUndo((ctx) => runCommand(ctx, setVisible, { ids: [node.id], visible: !visible }));
            }}
            className={cn(
              "text-muted-foreground hover:text-foreground",
              visible ? "opacity-0 group-hover:opacity-100" : "opacity-100",
            )}
          >
            {visible ? <EyeIcon className="size-3" /> : <EyeOffIcon className="size-3" />}
          </button>
        </>
      ) : null}
    </div>
  );
}
