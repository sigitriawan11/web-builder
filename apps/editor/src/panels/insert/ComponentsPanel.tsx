import { useLibraryComponents } from "@platform/sdk/react";
import type { LibraryComponentListItem } from "@platform/shared/contracts";
import { useLocale, useT } from "../../app/i18n";
import type { CanvasRuntime } from "../../canvas/canvas-runtime";
import { startPanelInsertDrag } from "../../canvas/drag/insert-drop";
import { insertComponentInstance } from "./insert-elements";

// T3.6.1/ED-151 + T3.6.2/ED-170: daftar component library published, dikelompokkan per kategori (slug dari item).
// Klik → sisip ke parent terpilih/page aktif; drag ke canvas → smart insert (parent+index geometrik, penanda sisip).
export function ComponentsPanel({ runtime, readOnly }: { runtime: CanvasRuntime; readOnly: boolean }) {
  const t = useT();
  const locale = useLocale();
  const components = useLibraryComponents();

  if (components.isPending) return <p className="p-2 text-xs text-muted-foreground">{t("insert.componentsLoading")}</p>;
  if (components.isError) return <p className="p-2 text-xs text-destructive">{t("insert.componentsError")}</p>;
  if (components.data.length === 0)
    return <p className="p-2 text-xs text-muted-foreground">{t("insert.componentsEmpty")}</p>;

  // Kelompokkan per categorySlug (urutan stabil berdasarkan kemunculan).
  const groups = new Map<string, LibraryComponentListItem[]>();
  for (const item of components.data) {
    const list = groups.get(item.categorySlug) ?? [];
    list.push(item);
    groups.set(item.categorySlug, list);
  }

  return (
    <div className="p-2" data-testid="components-panel">
      <h2 className="mb-1 px-1 text-xs font-semibold">{t("insert.components")}</h2>
      {[...groups.entries()].map(([slug, items]) => (
        <section key={slug} className="mb-2">
          <h3 className="px-1 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">{slug}</h3>
          <div className="flex flex-col gap-1">
            {items.map((item) => (
              <button
                key={item.publicId}
                type="button"
                disabled={readOnly}
                data-testid={`insert-component-${item.publicId}`}
                className="flex items-center gap-2 rounded border px-2 py-1.5 text-left text-xs hover:bg-accent disabled:opacity-50"
                onPointerDown={(e) => {
                  if (readOnly || e.button !== 0) return;
                  startPanelInsertDrag({
                    runtime,
                    startX: e.clientX,
                    startY: e.clientY,
                    onDrop: (target) =>
                      insertComponentInstance(runtime, { publicId: item.publicId, version: item.version }, target),
                  });
                }}
                onClick={() => insertComponentInstance(runtime, { publicId: item.publicId, version: item.version })}
              >
                {/* T3.7.3/CMP-014: thumbnail breakpoint base (presigned). Lazy-load; tanpa thumbnail → tanpa gambar. */}
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    data-testid={`component-thumb-${item.publicId}`}
                    className="h-8 w-12 shrink-0 rounded border object-cover"
                  />
                ) : null}
                <span className="font-medium">{item.displayName[locale] || item.name}</span>
                {/* CMP-001: istilah kind dilokalkan (Elemen/Blok/Seksi/…). */}
                <span className="ml-auto text-[10px] text-muted-foreground">{t(`componentKind.${item.kind}`)}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
