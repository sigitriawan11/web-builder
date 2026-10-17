import { type Breakpoint, type SiteDocument, yDocToJson } from "@platform/document-model";
import { renderToStaticHtml } from "@platform/renderer";
import { cn } from "@platform/ui";
import { MonitorIcon, SmartphoneIcon, TabletIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";
import type { CanvasRuntime } from "../canvas/canvas-runtime";
import { usePreviewWidths } from "../document/use-preview-widths";
import { previewModeStore } from "../store/preview-mode-store";
import { useT } from "./i18n";

const DEVICES: { id: Breakpoint; Icon: typeof MonitorIcon }[] = [
  { id: "base", Icon: MonitorIcon },
  { id: "tablet", Icon: TabletIcon },
  { id: "mobile", Icon: SmartphoneIcon },
];

// ED-004/ED-207: preview interaktif full-screen di dalam editor. Render page lewat renderer statis (media query nyata
// via iframe). Mod+Enter masuk/keluar, Esc keluar — tanpa menyentuh seleksi/kamera. Navigasi antar page tetap di
// overlay (intercept klik link ke page). Asset upload (gambar) menyusul Epic 2.12.
export function PreviewOverlay({ runtime, pageId }: { runtime: CanvasRuntime; pageId: string }) {
  const t = useT();
  const open = useStore(previewModeStore, (state) => state.open);
  const widths = usePreviewWidths(runtime.doc);
  const [device, setDevice] = useState<Breakpoint>("base");
  const [currentPage, setCurrentPage] = useState(pageId);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Shortcut Mod+Enter/Esc hidup lewat usePreviewShortcut (selalu terpasang), bukan di sini (overlay lazy).
  useEffect(() => {
    if (open) setCurrentPage(pageId);
  }, [open, pageId]);

  const doc = useMemo(() => (open ? (yDocToJson(runtime.doc) as SiteDocument) : null), [open, runtime.doc]);
  const pages = useMemo(
    () =>
      (doc?.pageOrder ?? []).flatMap((id) => {
        const node = doc?.nodes[id];
        return node?.type === "page" ? [{ id, title: node.props.title, path: node.props.path }] : [];
      }),
    [doc],
  );
  const html = useMemo(() => {
    if (!doc) return "";
    try {
      return renderToStaticHtml(doc, currentPage, { assetUrl: (assetId) => `/_assets/${assetId}` }).html;
    } catch {
      return "";
    }
  }, [doc, currentPage]);

  // Navigasi link antar page tetap di dalam preview (intercept klik <a> yang menuju path page).
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !open) return;
    const onLoad = () => {
      const win = frame.contentWindow;
      const document = win?.document;
      if (!document) return;
      document.addEventListener(
        "click",
        (event) => {
          const anchor = (event.target as HTMLElement | null)?.closest?.("a");
          const href = anchor?.getAttribute("href");
          if (!href) return;
          const match = pages.find((page) => page.path === href);
          if (match) {
            event.preventDefault();
            setCurrentPage(match.id);
          } else if (/^https?:/.test(href)) {
            event.preventDefault();
            window.open(href, "_blank", "noopener");
          }
        },
        true,
      );
    };
    frame.addEventListener("load", onLoad);
    return () => frame.removeEventListener("load", onLoad);
  }, [open, pages]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-100" data-testid="preview-overlay">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-background px-3">
        <div className="flex items-center gap-0.5" role="toolbar" aria-label={t("preview.device")}>
          {DEVICES.map(({ id, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={device === id}
              aria-label={t(`breakpoints.${id}`)}
              data-testid={`preview-device-${id}`}
              onClick={() => setDevice(id)}
              className={cn(
                "flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent",
                device === id && "bg-accent text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
        <select
          aria-label={t("preview.page")}
          data-testid="preview-page"
          value={currentPage}
          onChange={(event) => setCurrentPage(event.target.value)}
          className="h-7 rounded border border-input bg-transparent px-1 text-xs"
        >
          {pages.map((page) => (
            <option key={page.id} value={page.id}>
              {page.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => previewModeStore.getState().setOpen(false)}
          data-testid="preview-close"
          aria-label={t("preview.close")}
          className="ml-auto flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-accent"
        >
          <XIcon className="size-3.5" />
          {t("preview.close")}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <iframe
          ref={iframeRef}
          title={t("preview.title")}
          data-testid="preview-iframe"
          srcDoc={html}
          style={{ width: widths[device], minHeight: "100%" }}
          className="mx-auto block border-0 bg-white shadow-lg"
        />
      </div>
    </div>,
    document.body,
  );
}
