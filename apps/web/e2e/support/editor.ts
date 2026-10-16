// Bentuk `window.__editorTest` (hook DEV editor, apps/editor/src/collaboration/editor-test-hook.ts). Diduplikasi
// minimal karena app tidak boleh mengimpor app lain.
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
