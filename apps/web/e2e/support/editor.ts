import type { Page } from "@playwright/test";

// Bentuk `window.__editorTestApi` (ED-242, apps/editor/src/collaboration/editor-test-hook.ts). Diduplikasi minimal
// karena app tidak boleh mengimpor app lain.
export interface EditorTestApi {
  getDoc: () => unknown;
  select: (ids: string[]) => void;
  getSelection: () => readonly string[];
  getCamera: () => { x: number; y: number; zoom: number };
  setCamera: (camera: Partial<{ x: number; y: number; zoom: number }>) => void;
  getGeometry: (id: string) => { x: number; y: number; width: number; height: number } | null;
  runCommand: (name: string, args: unknown) => unknown;
  status: () => string;
  unsaved: () => boolean;
  setSchemaVersion: (version: number) => void;
  crash: () => void;
}

declare global {
  interface Window {
    __editorTestApi?: EditorTestApi;
  }
}

export interface CommandOutcome {
  ok: boolean;
  value?: unknown;
  error?: { code: string };
}

/** Jalankan command document-model di editor (origin tab, seperti aksi user). */
export function editorCommand(page: Page, name: string, args: unknown): Promise<CommandOutcome> {
  return page.evaluate(({ name, args }) => window.__editorTestApi?.runCommand(name, args) as CommandOutcome, {
    name,
    args,
  });
}

export async function firstPageId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const doc = window.__editorTestApi?.getDoc() as { pageOrder: string[] } | undefined;
    return doc?.pageOrder[0] ?? "";
  });
}

export async function renamePage(page: Page, pageId: string, title: string): Promise<boolean> {
  return (await editorCommand(page, "updatePage", { id: pageId, patch: { title } })).ok;
}

export const unsaved = (page: Page) => page.evaluate(() => window.__editorTestApi?.unsaved() ?? false);
