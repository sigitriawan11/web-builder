import { plainText, type SiteDocument, yDocToJson } from "@platform/document-model";
import { cn, Dialog, DialogContent, DialogTitle } from "@platform/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { zoomToSelection } from "../../canvas/fit-commands";
import { layerSearchStore } from "../../store/layer-search-store";
import { selectionStore } from "../../store/selection-store";

// ED-031: Mod+F — cari layer di PAGE AKTIF berdasarkan nama atau isi teks → pilih node & zoom to selection.
// Berbeda dari command palette "Ke layer" (semua page, nama saja); ini terfokus & memindai konten teks.

interface LayerItem {
  id: string;
  name: string;
  typeLabel: string;
  search: string;
}

const matches = (query: string, search: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return q.split(/\s+/).every((token) => search.includes(token));
};

export function LayerSearch({ runtime }: { runtime: CanvasRuntime }) {
  const t = useT();
  const open = useStore(layerSearchStore, (state) => state.open);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Snapshot layer page aktif saat dibuka (nama + teks terindeks).
  const layers = useMemo((): LayerItem[] => {
    if (!open) return [];
    const doc = yDocToJson(runtime.doc) as SiteDocument;
    const out: LayerItem[] = [];
    const walk = (id: string) => {
      const node = doc.nodes[id];
      if (!node) return;
      if (id !== runtime.pageId) {
        const text = node.type === "text" ? plainText(node.props.content) : "";
        out.push({
          id,
          name: node.name,
          typeLabel: t(`nodeType.${node.type}`),
          search: `${node.name} ${text}`.toLowerCase(),
        });
      }
      if ("children" in node) for (const child of node.children) walk(child);
    };
    walk(runtime.pageId);
    return out;
  }, [open, runtime, t]);

  const items = useMemo(() => layers.filter((item) => matches(query, item.search)), [layers, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      inputRef.current?.focus();
    }
  }, [open]);
  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  const choose = (item: LayerItem | undefined) => {
    if (!item) return;
    layerSearchStore.getState().setOpen(false);
    selectionStore.getState().select([item.id]);
    zoomToSelection(runtime);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => layerSearchStore.getState().setOpen(next)}>
      <DialogContent
        className="top-[20%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0"
        closeLabel={t("layerSearch.close")}
        data-testid="layer-search"
      >
        <DialogTitle className="sr-only">{t("layerSearch.title")}</DialogTitle>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, items.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              choose(items[active]);
            }
          }}
          placeholder={t("layerSearch.placeholder")}
          aria-label={t("layerSearch.title")}
          data-testid="layer-search-input"
          className="w-full border-b bg-transparent px-3 py-3 text-sm outline-none"
        />
        <div role="listbox" aria-label={t("layerSearch.title")} className="max-h-80 overflow-y-auto p-1">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("layerSearch.empty")}</p>
          ) : (
            items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={index === active}
                data-testid="layer-search-item"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm",
                  index === active && "bg-accent",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground">{item.typeLabel}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
