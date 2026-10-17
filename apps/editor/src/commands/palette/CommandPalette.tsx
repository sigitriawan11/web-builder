import { type SiteDocument, yDocToJson } from "@platform/document-model";
import { translate } from "@platform/i18n";
import { cn, Dialog, DialogContent, DialogTitle } from "@platform/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import { formatShortcut } from "../../app/chrome/shortcut";
import { useLocale, useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { zoomToSelection } from "../../canvas/fit-commands";
import { paletteStore } from "../../store/palette-store";
import { selectionStore } from "../../store/selection-store";
import { bindingById, primaryShortcut } from "../shortcut-registry";
import { PALETTE_ACTIONS } from "./actions";

// ED-204: command palette. Mod+/ (selalu) / Mod+K (tanpa seleksi). Sumber: aksi registry + "Ke halaman"/"Ke layer".
// Pencarian fuzzy bilingual (judul ID & EN keduanya diindeks → satu item). cmdk belum dipakai; dibuat dari Dialog.

interface Item {
  key: string;
  label: string;
  hint?: string;
  shortcut?: string;
  search: string;
  run(): void;
}

const matches = (query: string, search: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return q.split(/\s+/).every((token) => search.includes(token));
};

export function CommandPalette({ runtime }: { runtime: CanvasRuntime }) {
  const t = useT();
  const locale = useLocale();
  const open = useStore(paletteStore, (state) => state.open);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Snapshot halaman & layer dibaca saat palette dibuka (nama untuk "Ke halaman/layer").
  const snapshot = useMemo(() => {
    if (!open) return { pages: [] as { id: string; title: string }[], layers: [] as { id: string; name: string }[] };
    const doc = yDocToJson(runtime.doc) as SiteDocument;
    const pages = doc.pageOrder.flatMap((id) => {
      const node = doc.nodes[id];
      return node?.type === "page" ? [{ id, title: node.props.title }] : [];
    });
    const layers = Object.values(doc.nodes).flatMap((node) =>
      node.type === "page" ? [] : [{ id: node.id, name: node.name }],
    );
    return { pages, layers };
  }, [open, runtime.doc]);

  const close = () => paletteStore.getState().setOpen(false);

  const items = useMemo((): Item[] => {
    const commandItems: Item[] = PALETTE_ACTIONS.filter((action) => !action.enabled || action.enabled(runtime)).flatMap(
      (action) => {
        const binding = bindingById(action.id);
        if (!binding) return [];
        const id = translate("id", "editor", binding.titleKey);
        const en = translate("en", "editor", binding.titleKey);
        const shortcut = primaryShortcut(action.id);
        return [
          {
            key: action.id,
            label: locale === "id" ? id : en,
            ...(shortcut ? { shortcut: formatShortcut(shortcut) } : {}),
            search: `${id} ${en}`.toLowerCase(),
            run: () => action.run(runtime),
          },
        ];
      },
    );
    const pageItems: Item[] = snapshot.pages.map((page) => ({
      key: `page:${page.id}`,
      label: page.title,
      hint: t("palette.goToPage"),
      search: `${t("palette.goToPage")} ${page.title}`.toLowerCase(),
      run: () => runtime.setPage(page.id),
    }));
    const layerItems: Item[] = snapshot.layers.map((layer) => ({
      key: `layer:${layer.id}`,
      label: layer.name,
      hint: t("palette.goToLayer"),
      search: `${t("palette.goToLayer")} ${layer.name}`.toLowerCase(),
      run: () => {
        selectionStore.getState().select([layer.id]);
        zoomToSelection(runtime);
      },
    }));
    return [...commandItems, ...pageItems, ...layerItems].filter((item) => matches(query, item.search));
  }, [runtime, snapshot, query, locale, t]);

  // Reset saat dibuka; jaga indeks aktif dalam rentang hasil.
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

  const choose = (item: Item | undefined) => {
    if (!item) return;
    close();
    item.run();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => paletteStore.getState().setOpen(next)}>
      <DialogContent
        className="top-[20%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0"
        closeLabel={t("palette.close")}
        data-testid="command-palette"
      >
        <DialogTitle className="sr-only">{t("palette.title")}</DialogTitle>
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
          placeholder={t("palette.placeholder")}
          aria-label={t("palette.title")}
          data-testid="command-palette-input"
          className="w-full border-b bg-transparent px-3 py-3 text-sm outline-none"
        />
        <div role="listbox" aria-label={t("palette.commands")} className="max-h-80 overflow-y-auto p-1">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("palette.empty")}</p>
          ) : (
            items.map((item, index) => (
              <button
                key={item.key}
                type="button"
                role="option"
                aria-selected={index === active}
                data-testid="command-palette-item"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm",
                  index === active && "bg-accent",
                )}
              >
                {item.hint ? <span className="text-xs text-muted-foreground">{item.hint}</span> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.shortcut ? <kbd className="text-xs text-muted-foreground">{item.shortcut}</kbd> : null}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
