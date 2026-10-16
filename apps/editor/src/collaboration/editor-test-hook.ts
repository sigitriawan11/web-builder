import { runCommand, updatePage, YDOC_KEYS } from "@platform/document-model";
import { useEffect } from "react";
import type { CanvasRuntime } from "../canvas/canvas-runtime";
import type { DocumentSession } from "./document-session";

// Hook uji DEV ONLY (ED-242, dilengkapi T1.15.17): e2e mengubah dokumen lewat command document-model, bukan Y.Doc
// langsung, dengan origin lokal tab ini (dilacak undo — sama seperti aksi user). Tidak pernah ada di build production
// (`import.meta.env.DEV`).
export interface EditorTestApi {
  status: () => string;
  // ED-200: ada perubahan lokal yang belum dikonfirmasi server (`saved`).
  unsaved: () => boolean;
  pageIds: () => string[];
  renamePage: (pageId: string, title: string) => boolean;
}

declare global {
  interface Window {
    __editorTest?: EditorTestApi;
  }
}

export function useEditorTestHook(session: DocumentSession, runtime: CanvasRuntime): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const ctx = { doc: runtime.doc, origin: runtime.origin };
    window.__editorTest = {
      status: () => session.status(),
      unsaved: () => session.save.hasUnsaved(),
      pageIds: () => session.doc.getArray<string>(YDOC_KEYS.pageOrder).toArray(),
      renamePage: (pageId, title) => {
        // Sama dengan UI: sesi read-only (lock/akses) tidak mengubah dokumen.
        if (runtime.isReadOnly()) return false;
        // Aksi diskrit (seperti commit drag): tidak digabung captureTimeout dengan aksi sebelumnya.
        runtime.undo.stopCapturing();
        return runCommand(ctx, updatePage, { id: pageId, patch: { title } }).ok;
      },
    };
    return () => {
      delete window.__editorTest;
    };
  }, [session, runtime]);
}
