import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@platform/ui";
import { FileIcon, HomeIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { useNode } from "../../document/use-node";
import {
  addPage,
  duplicatePage,
  movePage,
  type PageActionContext,
  removePage,
  renamePage,
  setHomePage,
} from "./page-actions";

// ED-032: Pages panel — daftar (ikon home/statis), klik = buka page, + tambah, double-click = rename, menu ⋯
// (rename, duplikat, jadikan home, hapus dengan konfirmasi; home dilindungi), reorder drag (pointer & keyboard).

interface PagesPanelProps {
  runtime: CanvasRuntime;
  pageOrder: readonly string[];
  activePageId: string;
  readOnly: boolean;
  onOpen(pageId: string): void;
}

function PageRow({
  id,
  active,
  readOnly,
  context,
  onOpen,
  onDelete,
}: {
  id: string;
  active: boolean;
  readOnly: boolean;
  context: PageActionContext;
  onOpen(id: string): void;
  onDelete(id: string): void;
}) {
  const t = useT();
  const node = useNode(id);
  const [editing, setEditing] = useState(false);
  const sortable = useSortable({ id, disabled: readOnly || editing });
  if (node?.type !== "page") return null;
  const { title } = node.props;
  const isHome = node.props.isHome === true;
  const Icon = isHome ? HomeIcon : FileIcon;

  const commit = (value: string) => {
    renamePage(context, id, value);
    setEditing(false);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit(event.currentTarget.value);
    else if (event.key === "Escape") setEditing(false);
  };

  return (
    <li
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      data-page-id={id}
      data-testid="page-row"
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex h-7 items-center gap-1.5 rounded px-1.5 text-xs",
        active ? "bg-accent font-medium" : "hover:bg-accent/60",
        sortable.isDragging && "opacity-60",
      )}
      // Saat rename, atribut sortable (mis. `aria-disabled`) tidak dipasang — input di dalamnya harus tetap aktif bagi
      // pembaca layar & keyboard.
      {...(editing ? {} : { ...sortable.attributes, ...sortable.listeners })}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-label={isHome ? t("pages.home") : undefined} />
      {editing ? (
        <input
          // biome-ignore lint/a11y/noAutofocus: rename inline dimulai user (double-click / menu), fokus wajib.
          autoFocus
          aria-label={t("pages.rename")}
          defaultValue={title}
          className="h-5 min-w-0 flex-1 rounded border bg-background px-1"
          onKeyDown={onKeyDown}
          onBlur={(event) => commit(event.currentTarget.value)}
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : (
        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left"
          onClick={() => onOpen(id)}
          onDoubleClick={() => !readOnly && setEditing(true)}
        >
          {title}
        </button>
      )}
      {readOnly ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("pages.actions", { title })}
              className="rounded p-0.5 opacity-0 hover:bg-background group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              data-testid="page-actions"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <MoreHorizontalIcon className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditing(true)}>{t("pages.rename")}</DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                const copy = duplicatePage(context, id, (source) => t("pages.copyTitle", { title: source }));
                if (copy) onOpen(copy);
              }}
            >
              {t("pages.duplicate")}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={isHome} onSelect={() => setHomePage(context, id)}>
              {t("pages.setHome")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={isHome} onSelect={() => onDelete(id)}>
              {t("pages.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

export function PagesPanel({ runtime, pageOrder, activePageId, readOnly, onOpen }: PagesPanelProps) {
  const t = useT();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const pendingNode = useNode(pendingDelete ?? "");
  const context: PageActionContext = {
    doc: runtime.doc,
    origin: runtime.origin,
    undoBoundary: () => runtime.undo.stopCapturing(),
  };
  const sensors = useSensors(
    // Jarak minimum: klik (buka page) & double-click (rename) tidak dianggap drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = pageOrder.indexOf(String(active.id));
    const to = pageOrder.indexOf(String(over.id));
    if (from >= 0 && to >= 0) movePage(context, arrayMove([...pageOrder], from, to));
  };

  return (
    <div className="flex flex-col gap-1" data-testid="pages-panel">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label={t("pages.add")}
          title={t("pages.add")}
          disabled={readOnly}
          data-testid="page-add"
          onClick={() => {
            const id = addPage(context, t("pages.newTitle", { number: pageOrder.length + 1 }));
            if (id) onOpen(id);
          }}
        >
          <PlusIcon />
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={[...pageOrder]} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-0.5" data-testid="document-pages">
            {pageOrder.map((id) => (
              <PageRow
                key={id}
                id={id}
                active={id === activePageId}
                readOnly={readOnly}
                context={context}
                onOpen={onOpen}
                onDelete={setPendingDelete}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent closeLabel={t("session.dismiss")} data-testid="page-delete-dialog">
          <DialogHeader>
            <DialogTitle>
              {t("pages.deleteTitle", { title: pendingNode?.type === "page" ? pendingNode.props.title : "" })}
            </DialogTitle>
            <DialogDescription>{t("pages.deleteDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              {t("pages.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const id = pendingDelete;
                setPendingDelete(null);
                if (!id) return;
                // Page aktif dihapus → buka page lain lebih dulu.
                if (id === activePageId) onOpen(pageOrder.find((other) => other !== id) ?? id);
                removePage(context, id);
              }}
            >
              {t("pages.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
