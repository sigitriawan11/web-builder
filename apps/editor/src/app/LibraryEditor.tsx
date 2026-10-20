import { ComponentNodeSchema, userOrigin } from "@platform/document-model";
import { isApiError } from "@platform/sdk";
import { useLibraryEditorSession } from "@platform/sdk/react";
import type { LibraryEditorSession } from "@platform/shared/contracts";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { useStore } from "zustand";
import { CanvasViewport } from "../canvas/CanvasViewport";
import { type CanvasRuntime, createCanvasRuntime } from "../canvas/canvas-runtime";
import type { DocumentSession } from "../collaboration/document-session";
import { useLibraryDocumentSession } from "../collaboration/use-library-document-session";
import { isEditableEvent } from "../commands/is-editable-target";
import { CreateComponentDialog } from "../panels/components/CreateComponentDialog";
import { selectionStore } from "../store/selection-store";
import { useLocale, useT } from "./i18n";
import { SiteNotFound } from "./SiteEditor";

// T3.4.1/T3.4.2 (CMP-010/ED-003, Approach A): editor Mode Admin. Akses diverifikasi SERVER (bukan staf → 404).
// Dokumen = draft ComponentDefinition (Yjs `kind='component'`) dibuka via token admin (D3). Canvas me-render dari
// `rootId` (bukan page situs). Panel Component/Props/Variants/QA = T3.4.3+.
const TAB_ORIGIN = userOrigin(crypto.randomUUID());

export function LibraryEditor({ componentId }: { componentId: string }) {
  const t = useT();
  const session = useLibraryEditorSession(componentId);
  const status = isApiError(session.error) ? session.error.status : null;

  useEffect(() => {
    if (status === 401) {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status]);

  if (session.isPending || status === 401) {
    return (
      <main className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground" aria-busy>
        {t("app.loading")}
      </main>
    );
  }
  // Bukan staf → 404; staf tanpa akses baca → 403: keduanya "tidak ditemukan" (permukaan admin tak bocor).
  if (status === 404 || status === 403) return <SiteNotFound />;
  if (session.error) throw session.error;

  return <LibraryWorkspace componentId={componentId} data={session.data} />;
}

function LibraryWorkspace({ componentId, data }: { componentId: string; data: LibraryEditorSession }) {
  const t = useT();
  const { component, capabilities } = data;
  const draftDocumentId = component.draftDocumentId;

  if (!draftDocumentId) {
    // Component tanpa draft aktif (mis. hanya versi published) — editing versi baru = T3.4.x.
    return (
      <AdminShell component={component} capabilities={capabilities}>
        <p className="m-auto text-sm text-muted-foreground">{t("admin.canvasPending")}</p>
      </AdminShell>
    );
  }
  return (
    <AdminShell component={component} capabilities={capabilities}>
      <LibraryCanvas componentId={componentId} draftDocumentId={draftDocumentId} canEdit={capabilities.canEditDraft} />
    </AdminShell>
  );
}

function LibraryCanvas({
  componentId,
  draftDocumentId,
  canEdit,
}: {
  componentId: string;
  draftDocumentId: string;
  canEdit: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const { session } = useLibraryDocumentSession(draftDocumentId, componentId);
  const rootId = useRootId(session);
  const runtime = useComponentRuntime(session, rootId);
  const selectedIds = useStore(selectionStore, (state) => state.selectedIds);
  const [createOpen, setCreateOpen] = useState(false);

  // Binding aset library = T3.4.13; draft awal tanpa aset. `configureAssetUrl` (situs) tidak dipanggil di sini.
  useEffect(() => runtime?.setReadOnly(!canEdit), [runtime, canEdit]);

  // CMP-011: Cmd/Ctrl+Alt+K → dialog "Buat component dari seleksi" (hanya saat bisa edit & ada seleksi).
  useEffect(() => {
    if (!canEdit) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEvent(event)) return;
      if ((event.metaKey || event.ctrlKey) && event.altKey && event.code === "KeyK") {
        if (selectionStore.getState().selectedIds.length === 0) return;
        event.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canEdit]);

  if (!runtime) {
    return <p className="m-auto text-sm text-muted-foreground">{t("app.loading")}</p>;
  }
  return (
    <>
      <CanvasViewport runtime={runtime} />
      <CreateComponentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        runtime={runtime}
        selectedIds={selectedIds}
        locale={locale}
      />
    </>
  );
}

// `rootId` dari meta Y.Doc component (muncul setelah sinkron). Null selama belum ada.
function useRootId(session: DocumentSession | null): string | null {
  return useSyncExternalStore(
    (onChange) => {
      if (!session) return () => {};
      const meta = session.doc.getMap<unknown>("meta");
      meta.observe(onChange);
      return () => meta.unobserve(onChange);
    },
    () => {
      const value = session?.doc.getMap<unknown>("meta").get("rootId");
      return typeof value === "string" ? value : null;
    },
  );
}

// Runtime canvas per dokumen; dibuat di effect (StrictMode-safe, sama pola SiteEditor). Root = `rootId` component yang
// muncul setelah sinkron → effect bergantung pada `rootId` juga (kalau tidak, runtime tak pernah dibuat saat rootId
// datang belakangan). `rootId` stabil untuk satu component, jadi tak ada rekreasi berulang.
function useComponentRuntime(session: DocumentSession | null, rootId: string | null): CanvasRuntime | null {
  const [runtime, setRuntime] = useState<CanvasRuntime | null>(null);
  useEffect(() => {
    if (!session || !rootId) return;
    // Node ComponentDefinition (root parentId null, slot, $prop) → validator component, bukan schema node situs.
    const next = createCanvasRuntime({
      doc: session.doc,
      pageId: rootId,
      origin: TAB_ORIGIN,
      nodeSchema: ComponentNodeSchema,
    });
    setRuntime(next);
    return () => {
      setRuntime(null);
      next.destroy();
    };
  }, [session, rootId]);
  return runtime;
}

function AdminShell({
  component,
  capabilities,
  children,
}: {
  component: LibraryEditorSession["component"];
  capabilities: LibraryEditorSession["capabilities"];
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex h-full flex-col bg-background text-foreground" data-admin-mode="library">
      <header className="flex items-center gap-3 border-b px-4 py-2">
        <span
          className="rounded bg-amber-500 px-2 py-0.5 text-xs font-bold tracking-wide text-black"
          data-testid="admin-badge"
        >
          {t("admin.badge")}
        </span>
        <span className="text-sm font-medium">{component.displayName.id || component.name}</span>
        <span className="text-xs text-muted-foreground">{component.publicId}</span>
        {!capabilities.canEditDraft ? (
          <span className="ml-auto text-xs text-muted-foreground" data-testid="admin-readonly">
            {t("admin.readOnly")}
          </span>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 bg-muted/40">{children}</div>
    </div>
  );
}
