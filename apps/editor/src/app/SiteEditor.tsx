import { userOrigin } from "@platform/document-model";
import { isApiError } from "@platform/sdk";
import { useSite } from "@platform/sdk/react";
import type { Site } from "@platform/shared/contracts";
import { Button } from "@platform/ui";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { useStore } from "zustand";
import { CanvasViewport } from "../canvas/CanvasViewport";
import { type CanvasRuntime, createCanvasRuntime } from "../canvas/canvas-runtime";
import type { DocumentSession } from "../collaboration/document-session";
import { discardLocalDocument } from "../collaboration/document-session";
import { EditAccessGate } from "../collaboration/EditAccessGate";
import { useEditorTestHook } from "../collaboration/editor-test-hook";
import { SaveIndicator } from "../collaboration/SaveIndicator";
import { SessionBanners } from "../collaboration/SessionBanners";
import { useDocumentSession } from "../collaboration/use-document-session";
import { CommandPalette } from "../commands/palette/CommandPalette";
import { DevInsertBar, devToolsEnabled } from "../dev/DevInsertBar";
import { isNewerThanEditor, reloadOnceForSchema, useDocumentSchemaVersion } from "../document/schema-gate";
import { NodeStoreContext, useNodeFromStore } from "../document/use-node";
import { usePageOrder } from "../document/use-page-order";
import { InsertPanel } from "../panels/insert/InsertPanel";
import { LeftSidebar } from "../panels/LeftSidebar";
import { LayersPanel } from "../panels/layers/LayersPanel";
import { PageSettings } from "../panels/pages/PageSettings";
import { PagesPanel } from "../panels/pages/PagesPanel";
import { Inspector } from "../panels/properties/Inspector";
import { uiPreferencesStore } from "../store/ui-preferences";
import { setTelemetryScope } from "../telemetry/telemetry";
import { BottomBar } from "./chrome/BottomBar";
import { Toolbar } from "./chrome/Toolbar";
import { AppErrorBoundary } from "./ErrorBoundary";
import { useT } from "./i18n";
import { LanguageMenu, ProfileLocaleSync } from "./LanguageMenu";
import { PreviewOverlay } from "./PreviewOverlay";
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
  // ED-032: page yang diminta (`?page=` awal, lalu klik di Pages panel) — URL diperbarui tanpa reload.
  const [requestedPage, setRequestedPage] = useState(pageId);
  const openPage = useCallback((id: string) => {
    setRequestedPage(id);
    const url = new URL(window.location.href);
    url.searchParams.set("page", id);
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const workspace = useWorkspaceRuntime(session, requestedPage);
  const bottomBarHidden = useStore(uiPreferencesStore, (state) => state.bottomBarHidden);
  const pageNode = useNodeFromStore(workspace.runtime?.nodeStore ?? null, workspace.activePageId);
  return (
    <div className="flex h-full flex-col bg-background text-foreground" data-connection-status={status}>
      <Toolbar
        siteName={site.name}
        pageTitle={pageNode?.type === "page" ? pageNode.props.title : null}
        runtime={workspace.runtime}
        status={session ? <SaveIndicator session={session} /> : null}
        language={<LanguageMenu />}
      />
      {/* ED-006 edge: layar < 1024px tetap bisa dipakai, dengan pemberitahuan. */}
      <p
        className="hidden border-b bg-muted px-3 py-1 text-xs text-muted-foreground max-lg:block"
        data-testid="narrow-screen-banner"
      >
        {t("toolbar.narrowScreen")}
      </p>
      <ProfileLocaleSync />
      {session ? <SessionBanners session={session} status={status} /> : null}
      {session ? <EditAccessGate session={session} /> : null}
      <div
        className="flex min-h-0 flex-1 bg-muted/40"
        data-testid="editor-canvas-slot"
        data-page-id={workspace.activePageId ?? ""}
        data-requested-page-id={requestedPage ?? ""}
      >
        {session && status !== "loading" ? (
          <DocumentWorkspace session={session} workspace={workspace} onOpenPage={openPage} />
        ) : (
          <p className="m-auto text-sm text-muted-foreground">{t("app.loading")}</p>
        )}
      </div>
      {workspace.runtime && !bottomBarHidden ? (
        <NodeStoreContext.Provider value={workspace.runtime.nodeStore}>
          <BottomBar runtime={workspace.runtime} connection={status} />
        </NodeStoreContext.Provider>
      ) : null}
    </div>
  );
}

interface WorkspaceRuntime {
  runtime: CanvasRuntime | null;
  activePageId: string | null;
  pageOrder: readonly string[];
  schemaVersion: number | null;
  outdated: boolean;
  readOnly: boolean;
}

const NO_DOC = new Y.Doc();

// T1.15.8: runtime canvas untuk dokumen dari realtime; page aktif = `?page=` bila ada di dokumen, selain itu page
// pertama. Dipakai toolbar (undo, nama page) & workspace (canvas, panel).
function useWorkspaceRuntime(session: DocumentSession | null, pageId: string | null): WorkspaceRuntime {
  const doc = session?.doc ?? NO_DOC;
  const pageOrder = usePageOrder(doc);
  const schemaVersion = useDocumentSchemaVersion(doc);
  const outdated = isNewerThanEditor(schemaVersion);
  const readOnly = useEditAccessOrEditing(session) !== "editing";
  // Page diminta tidak ada (dihapus / ID salah) → page pertama.
  const activePageId = pageId && pageOrder.includes(pageId) ? pageId : (pageOrder[0] ?? null);
  const hasPage = activePageId !== null;
  // Runtime satu per DOKUMEN (bukan per page): ganti page = `setPage`, stack undo tetap (ED-197).
  // Dibuat di effect (bukan useMemo/useState): StrictMode menjalankan cleanup lalu effect lagi — runtime dari
  // useMemo akan sudah di-destroy (observer lepas) dan canvas berhenti mengikuti dokumen.
  const [runtime, setRuntime] = useState<CanvasRuntime | null>(null);
  const initialPage = useRef(activePageId);
  initialPage.current ??= activePageId;
  useEffect(() => {
    const first = initialPage.current;
    if (!session || !hasPage || !first || outdated) return;
    const next = createCanvasRuntime({ doc: session.doc, pageId: first, origin: TAB_ORIGIN });
    setRuntime(next);
    return () => {
      setRuntime(null);
      next.destroy();
    };
  }, [session, hasPage, outdated]);
  useEffect(() => {
    if (runtime && activePageId) runtime.setPage(activePageId);
  }, [runtime, activePageId]);
  useEffect(() => runtime?.setReadOnly(readOnly), [runtime, readOnly]);
  return { runtime, activePageId, pageOrder, schemaVersion, outdated, readOnly };
}

function useEditAccessOrEditing(session: DocumentSession | null): string {
  const subscribe = useCallback((listener: () => void) => session?.subscribeAccess(listener) ?? (() => {}), [session]);
  const read = useCallback(() => session?.access().kind ?? "editing", [session]);
  return useSyncExternalStore(subscribe, read, read);
}

function DocumentWorkspace({
  session,
  workspace,
  onOpenPage,
}: {
  session: DocumentSession;
  workspace: WorkspaceRuntime;
  onOpenPage(pageId: string): void;
}) {
  const { runtime, pageOrder, schemaVersion, outdated, readOnly, activePageId } = workspace;
  // ED-230: dokumen dari editor yang lebih baru → tidak ada canvas/runtime (tidak bisa diedit).
  if (outdated && schemaVersion !== null) return <EditorOutdated version={schemaVersion} />;
  if (!runtime || !activePageId) return null;
  return (
    <NodeStoreContext.Provider value={runtime.nodeStore}>
      {/* ED-242: test API hanya di build dev (ter-tree-shake dari production). */}
      {import.meta.env.DEV ? <EditorTestHook session={session} runtime={runtime} /> : null}
      <LeftSidebar
        layers={<LayersPanel runtime={runtime} pageId={activePageId} readOnly={readOnly} />}
        insert={<InsertPanel runtime={runtime} readOnly={readOnly} />}
        pages={
          <PagesPanel
            runtime={runtime}
            pageOrder={pageOrder}
            activePageId={activePageId}
            readOnly={readOnly}
            onOpen={onOpenPage}
          />
        }
      />
      <PreviewOverlay runtime={runtime} pageId={activePageId} />
      <CommandPalette runtime={runtime} />
      <div className="relative min-w-0 flex-1" data-testid="editor-canvas">
        <CanvasViewport runtime={runtime} />
        {devToolsEnabled() ? (
          <div className="absolute top-2 left-1/2 z-20 -translate-x-1/2 rounded-md border bg-background p-1 shadow-sm">
            <DevInsertBar runtime={runtime} readOnly={readOnly} />
          </div>
        ) : null}
        {/* ED-229: mode lihat saja — pointer ke canvas ditahan (server juga menolak update koneksi read-only). */}
        {readOnly ? <div className="absolute inset-0 z-10 cursor-not-allowed" data-testid="read-only-blocker" /> : null}
      </div>
      <Inspector
        pageId={activePageId}
        runtime={runtime}
        readOnly={readOnly}
        pageSettings={<PageSettings runtime={runtime} pageId={activePageId} readOnly={readOnly} />}
      />
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
