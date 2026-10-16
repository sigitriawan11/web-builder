import { userOrigin } from "@platform/document-model";
import { isApiError } from "@platform/sdk";
import { useSite } from "@platform/sdk/react";
import type { Site } from "@platform/shared/contracts";
import { Button } from "@platform/ui";
import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { CanvasViewport } from "../canvas/CanvasViewport";
import { type CanvasRuntime, createCanvasRuntime } from "../canvas/canvas-runtime";
import type { DocumentSession } from "../collaboration/document-session";
import { useEditorTestHook } from "../collaboration/editor-test-hook";
import { useDocumentSession } from "../collaboration/use-document-session";
import { NodeStoreContext, useNode } from "../document/use-node";
import { usePageOrder } from "../document/use-page-order";
import { useT } from "./i18n";
import { LanguageMenu, ProfileLocaleSync } from "./LanguageMenu";
// Tailwind + token UI hanya dimuat rute produk (modul ini di-lazy-load): playground canvas M0 & mode isolasi
// eksperimennya (prefix/none, ADR-012) tetap tanpa preflight global.
import "../styles/app.css";

// Editor satu situs (`/editor/:siteId`): situs dimuat lewat api (izin & isolasi tenant ditegakkan server). Tidak ada
// / bukan milik user → layar "tidak ditemukan" (api 404 untuk keduanya, tidak membocorkan keberadaan). Sesi basi →
// login. Dokumen: Y.Doc lokal (IndexedDB) → realtime (T1.15.7), canvas renderer (T1.15.8).
export function SiteEditor({ siteId, pageId }: { siteId: string; pageId: string | null }) {
  const t = useT();
  const site = useSite(siteId);
  const status = isApiError(site.error) ? site.error.status : null;

  useEffect(() => {
    if (status === 401) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status]);

  if (site.isPending || status === 401) {
    return (
      <main className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground" aria-busy>
        {t("app.loading")}
      </main>
    );
  }
  if (status === 404 || status === 403) return <SiteNotFound />;
  if (site.error) throw site.error;
  return <EditorShell site={site.data} pageId={pageId} />;
}

function EditorShell({ site, pageId }: { site: Site; pageId: string | null }) {
  const t = useT();
  const { session, status } = useDocumentSession(site.documentId);
  return (
    <div className="flex h-full flex-col bg-background text-foreground" data-connection-status={status}>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
        <Button asChild variant="ghost" size="icon" aria-label={t("app.back")} title={t("app.back")}>
          <a href="/sites">
            <ArrowLeftIcon />
          </a>
        </Button>
        <h1 className="truncate text-sm font-semibold" data-testid="editor-site-name">
          {site.name}
        </h1>
        <div className="ml-auto flex items-center gap-1">
          <LanguageMenu />
        </div>
      </header>
      <ProfileLocaleSync />
      <div className="flex min-h-0 flex-1 bg-muted/40" data-testid="editor-canvas-slot" data-page-id={pageId ?? ""}>
        {session && status !== "loading" ? (
          <DocumentWorkspace session={session} pageId={pageId} />
        ) : (
          <p className="m-auto text-sm text-muted-foreground">{t("app.loading")}</p>
        )}
      </div>
    </div>
  );
}

// T1.15.8: canvas (renderer mode editor + interaksi M0) untuk dokumen dari realtime; page aktif = `?page=` bila ada
// di dokumen, selain itu page pertama. Daftar page sementara (panel Pages = M2) juga bukti dokumen termuat.
function DocumentWorkspace({ session, pageId }: { session: DocumentSession; pageId: string | null }) {
  const pageOrder = usePageOrder(session.doc);
  const activePageId = pageId && pageOrder.includes(pageId) ? pageId : (pageOrder[0] ?? null);
  // Dibuat di effect (bukan useMemo/useState): StrictMode menjalankan cleanup lalu effect lagi — runtime dari
  // useMemo akan sudah di-destroy (observer lepas) dan canvas berhenti mengikuti dokumen.
  const [runtime, setRuntime] = useState<CanvasRuntime | null>(null);
  useEffect(() => {
    if (!activePageId) return;
    const next = createCanvasRuntime({ doc: session.doc, pageId: activePageId, origin: TAB_ORIGIN });
    setRuntime(next);
    return () => {
      setRuntime(null);
      next.destroy();
    };
  }, [session, activePageId]);
  if (!runtime) return null;
  return (
    <NodeStoreContext.Provider value={runtime.nodeStore}>
      <EditorTestHook session={session} runtime={runtime} />
      <aside className="w-48 shrink-0 overflow-y-auto border-r bg-background p-2 text-sm">
        <ul className="flex flex-col gap-1" data-testid="document-pages">
          {pageOrder.map((id) => (
            <PageItem key={id} id={id} active={id === runtime.pageId} />
          ))}
        </ul>
      </aside>
      <div className="relative min-w-0 flex-1" data-testid="editor-canvas">
        <CanvasViewport runtime={runtime} />
      </div>
    </NodeStoreContext.Provider>
  );
}

function EditorTestHook({ session, runtime }: { session: DocumentSession; runtime: CanvasRuntime }) {
  useEditorTestHook(session, runtime);
  return null;
}

// Origin transaksi lokal tab ini (DM-060): dilacak UndoManager; tab lain = sesi lain.
const TAB_ORIGIN = userOrigin(crypto.randomUUID());

function PageItem({ id, active }: { id: string; active: boolean }) {
  const node = useNode(id);
  if (node?.type !== "page") return null;
  return (
    <li data-page-id={id} aria-current={active ? "page" : undefined} className={active ? "font-semibold" : undefined}>
      {node.props.title}
    </li>
  );
}

export function SiteNotFound() {
  const t = useT();
  return (
    <main className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      <p className="text-5xl font-bold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">{t("app.notFound.title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("app.notFound.description")}</p>
      <Button asChild variant="outline">
        <a href="/sites">{t("app.notFound.back")}</a>
      </Button>
    </main>
  );
}
