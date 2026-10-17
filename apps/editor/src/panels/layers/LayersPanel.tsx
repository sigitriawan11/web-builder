import type { Node } from "@platform/document-model";
import { cn } from "@platform/ui";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FrameIcon,
  ImageIcon,
  type LucideIcon,
  SmileIcon,
  SquareIcon,
  StickyNoteIcon,
  TypeIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type NodeRendererProps, Tree } from "react-arborist";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { type LayerNode, useLayerTree } from "../../document/use-layer-tree";
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

// ED-136: tree layers virtualized (react-arborist). Seleksi ikut store seleksi canvas (dua arah).
export function LayersPanel({ runtime, pageId }: { runtime: CanvasRuntime; pageId: string; readOnly: boolean }) {
  const tree = useLayerTree(runtime.doc, runtime.nodeStore, pageId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
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
    <div ref={containerRef} className="min-h-0 flex-1" data-testid="layers-tree">
      {size.height > 0 ? (
        <Tree<LayerNode>
          data={tree}
          width={size.width}
          height={size.height}
          rowHeight={24}
          indent={12}
          openByDefault
          disableDrag
          disableDrop
          disableMultiSelection
        >
          {LayerRow}
        </Tree>
      ) : null}
    </div>
  );
}

function LayerRow({ node, style }: NodeRendererProps<LayerNode>) {
  const t = useT();
  const selectedIds = useStore(selectionStore, (state) => state.selectedIds);
  const selected = selectedIds.includes(node.id);
  const Icon = TYPE_ICON[node.data.type];
  const name = node.data.name || t(`nodeType.${node.data.type}`);
  return (
    <div
      style={style}
      role="treeitem"
      aria-selected={selected}
      aria-expanded={node.isInternal ? node.isOpen : undefined}
      tabIndex={-1}
      data-testid={`layer-${node.id}`}
      onClick={() => selectionStore.getState().select([node.id])}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectionStore.getState().select([node.id]);
        }
      }}
      className={cn(
        "flex h-6 cursor-default items-center gap-1 rounded px-1 text-xs",
        selected ? "bg-accent text-foreground" : "hover:bg-accent/50",
        !node.data.visible && "opacity-40",
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
              node.toggle();
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
      <span className="flex-1 truncate">{name}</span>
    </div>
  );
}
