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
import { discardLocalDocument } from "../collaboration/document-session";
import { EditAccessGate, useEditAccess } from "../collaboration/EditAccessGate";
import { useEditorTestHook } from "../collaboration/editor-test-hook";
import { SaveIndicator } from "../collaboration/SaveIndicator";
import { SessionBanners } from "../collaboration/SessionBanners";
import { useDocumentSession } from "../collaboration/use-document-session";
import { isNewerThanEditor, reloadOnceForSchema, useDocumentSchemaVersion } from "../document/schema-gate";
import { NodeStoreContext, useNode } from "../document/use-node";
import { usePageOrder } from "../document/use-page-order";
import { setTelemetryScope } from "../telemetry/telemetry";
import { AppErrorBoundary } from "./ErrorBoundary";
import { useT } from "./i18n";
import { LanguageMenu, ProfileLocaleSync } from "./LanguageMenu";
import { PanelErrorBoundary } from "./PanelErrorBoundary";
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
  return (
    <AppErrorBoundary recovery={{ openLastSaved: () => discardLocalDocument(site.data.documentId) }}>
      <EditorShell site={site.data} pageId={pageId} />
    </AppErrorBoundary>
  );
}

function EditorShell({ site, pageId }: { site: Site; pageId: string | null }) {
  const t = useT();
  useEffect(() => {
    void setTelemetryScope({ siteId: site.id });
  }, [site.id]);
  const { session, status } = useDocumentSession(site.documentId);
  return (
    <div className="flex h-full flex-col bg-background text-foreground" data-connection-status={status}>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3" data-testid="editor-header">
        <Button asChild variant="ghost" size="icon" aria-label={t("app.back")} title={t("app.back")}>
          <a href="/sites">
            <ArrowLeftIcon />
          </a>
        </Button>
        <h1 className="truncate text-sm font-semibold" data-testid="editor-site-name">
          {site.name}
        </h1>
        <div className="ml-auto flex items-center gap-1">
          {session ? <SaveIndicator session={session} /> : null}
          <LanguageMenu />
        </div>
      </header>
      <ProfileLocaleSync />
      {session ? <SessionBanners session={session} status={status} /> : null}
      {session ? <EditAccessGate session={session} /> : null}
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
  const schemaVersion = useDocumentSchemaVersion(session.doc);
  const outdated = isNewerThanEditor(schemaVersion);
  const readOnly = useEditAccess(session).kind !== "editing";
  const activePageId = pageId && pageOrder.includes(pageId) ? pageId : (pageOrder[0] ?? null);
  // Dibuat di effect (bukan useMemo/useState): StrictMode menjalankan cleanup lalu effect lagi — runtime dari
  // useMemo akan sudah di-destroy (observer lepas) dan canvas berhenti mengikuti dokumen.
  const [runtime, setRuntime] = useState<CanvasRuntime | null>(null);
  useEffect(() => {
    if (!activePageId || outdated) return;
    const next = createCanvasRuntime({ doc: session.doc, pageId: activePageId, origin: TAB_ORIGIN });
    setRuntime(next);
    return () => {
      setRuntime(null);
      next.destroy();
    };
  }, [session, activePageId, outdated]);
  useEffect(() => runtime?.setReadOnly(readOnly), [runtime, readOnly]);
  // ED-230: dokumen dari editor yang lebih baru → tidak ada canvas/runtime (tidak bisa diedit).
  if (outdated && schemaVersion !== null) return <EditorOutdated version={schemaVersion} />;
  if (!runtime) return null;
  return (
    <NodeStoreContext.Provider value={runtime.nodeStore}>
      {/* ED-242: test API hanya di build dev (ter-tree-shake dari production). */}
      {import.meta.env.DEV ? <EditorTestHook session={session} runtime={runtime} /> : null}
      <aside className="w-48 shrink-0 overflow-y-auto border-r bg-background p-2 text-sm">
        <PanelErrorBoundary name="pages">
          <ul className="flex flex-col gap-1" data-testid="document-pages">
            {pageOrder.map((id) => (
              <PageItem key={id} id={id} active={id === runtime.pageId} />
            ))}
          </ul>
        </PanelErrorBoundary>
      </aside>
      <div className="relative min-w-0 flex-1" data-testid="editor-canvas">
        <CanvasViewport runtime={runtime} />
        {/* ED-229: mode lihat saja — pointer ke canvas ditahan (server juga menolak update koneksi read-only). */}
        {readOnly ? <div className="absolute inset-0 z-10 cursor-not-allowed" data-testid="read-only-blocker" /> : null}
      </div>
    </NodeStoreContext.Provider>
  );
}

function EditorOutdated({ version }: { version: number }) {
  const t = useT();
  const [reloading, setReloading] = useState(false);
  useEffect(() => {
    if (reloadOnceForSchema(version, () => window.location.reload())) setReloading(true);
  }, [version]);
  if (reloading) return null;
  return (
    <div
      role="alert"
      className="m-auto flex max-w-sm flex-col items-center gap-3 p-6 text-center"
      data-testid="editor-outdated"
    >
      <h2 className="text-lg font-semibold">{t("schema.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("schema.description")}</p>
      <Button onClick={() => window.location.reload()}>{t("schema.reload")}</Button>
    </div>
  );
}

function EditorTestHook({ session, runtime }: { session: DocumentSession; runtime: CanvasRuntime }) {
  // Seam e2e (ED-231): kesalahan render sungguhan → error boundary → pelaporan.
  const [crash, setCrash] = useState(false);
  useEditorTestHook(session, runtime, () => setCrash(true));
  if (crash) throw new Error("e2e: kesalahan render disengaja");
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
