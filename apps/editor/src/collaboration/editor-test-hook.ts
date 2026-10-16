import { runCommand, updatePage, userOrigin, YDOC_KEYS } from "@platform/document-model";
import { useEffect } from "react";
import type { DocumentSession } from "./document-session";

// Hook uji DEV ONLY (ED-242, dilengkapi T1.15.17): e2e mengubah dokumen lewat command document-model, bukan Y.Doc
// langsung. Tidak pernah ada di build production (`import.meta.env.DEV`).
export interface EditorTestApi {
  status: () => string;
  pageIds: () => string[];
  renamePage: (pageId: string, title: string) => boolean;
}

declare global {
  interface Window {
    __editorTest?: EditorTestApi;
  }
}

export function useEditorTestHook(session: DocumentSession): void {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const origin = userOrigin("e2e");
    window.__editorTest = {
      status: () => session.status(),
      pageIds: () => session.doc.getArray<string>(YDOC_KEYS.pageOrder).toArray(),
      renamePage: (pageId, title) =>
        runCommand({ doc: session.doc, origin }, updatePage, { id: pageId, patch: { title } }).ok,
    };
    return () => {
      delete window.__editorTest;
    };
  }, [session]);
}
