// Bentuk `window.__editorTest` (hook DEV editor, apps/editor/src/collaboration/editor-test-hook.ts). Diduplikasi
// minimal karena app tidak boleh mengimpor app lain.
export interface EditorTestApi {
  status: () => string;
  // ED-200: ada perubahan lokal yang belum dikonfirmasi server (`saved`).
  unsaved: () => boolean;
  pageIds: () => string[];
  renamePage: (pageId: string, title: string) => boolean;
  setSchemaVersion: (version: number) => void;
  crash: () => void;
}

declare global {
  interface Window {
    __editorTest?: EditorTestApi;
  }
}
