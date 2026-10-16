import {
  createPage,
  deletePage,
  insertSubtree,
  reorderPages,
  runCommand,
  runCommands,
  type Subtree,
  step,
  uniquePagePath,
  updatePage,
  YDOC_KEYS,
  yDocToJson,
} from "@platform/document-model";
import type * as Y from "yjs";

// ED-032: aksi Pages panel lewat command document-model (origin tab → bisa di-undo, satu aksi = satu langkah).

export interface PageActionContext {
  doc: Y.Doc;
  origin: unknown;
  // Batas antar aksi diskrit (tidak digabung captureTimeout undo).
  undoBoundary(): void;
}

type DocJson = {
  nodes: Record<string, { type: string; props?: { path?: string; title?: string }; children?: string[] }>;
};

const docJson = (doc: Y.Doc) => yDocToJson(doc) as DocJson;

export function pagePaths(doc: Y.Doc): string[] {
  const json = docJson(doc);
  return doc
    .getArray<string>(YDOC_KEYS.pageOrder)
    .toArray()
    .map((id) => json.nodes[id]?.props?.path ?? "")
    .filter(Boolean);
}

/** Isi page (anak & turunannya) sebagai subtree untuk disalin; null bila page kosong. */
export function pageSubtree(doc: Y.Doc, pageId: string): Subtree | null {
  const { nodes } = docJson(doc);
  const rootIds = nodes[pageId]?.children ?? [];
  if (rootIds.length === 0) return null;
  const collected: Subtree["nodes"] = {};
  const stack = [...rootIds];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    const node = nodes[id];
    if (!node) continue;
    collected[id] = node as Record<string, unknown>;
    stack.push(...(node.children ?? []));
  }
  return { rootIds, nodes: collected };
}

const ctxOf = (context: PageActionContext) => ({ doc: context.doc, origin: context.origin as never });

/** Page kosong baru setelah page terakhir; mengembalikan ID page baru. */
export function addPage(context: PageActionContext, title: string): string | null {
  context.undoBoundary();
  const result = runCommand(ctxOf(context), createPage, { title, path: uniquePagePath(title, pagePaths(context.doc)) });
  return result.ok ? result.value : null;
}

/** Duplikat page beserta isinya tepat setelah aslinya — satu transaksi (satu langkah undo). */
export function duplicatePage(
  context: PageActionContext,
  pageId: string,
  copyTitle: (title: string) => string,
): string | null {
  const { nodes } = docJson(context.doc);
  const source = nodes[pageId];
  if (source?.type !== "page") return null;
  const title = copyTitle(source.props?.title ?? "");
  const order = context.doc.getArray<string>(YDOC_KEYS.pageOrder).toArray();
  const subtree = pageSubtree(context.doc, pageId);
  context.undoBoundary();
  const result = runCommands(ctxOf(context), (results) => {
    if (results.length === 0) {
      return step(createPage, {
        title,
        path: uniquePagePath(title, pagePaths(context.doc)),
        index: order.indexOf(pageId) + 1,
      });
    }
    if (results.length === 1 && subtree) return step(insertSubtree, { parentId: results[0] as string, subtree });
    return null;
  });
  return result.ok ? (result.value[0] as string) : null;
}

export function renamePage(context: PageActionContext, pageId: string, title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  context.undoBoundary();
  return runCommand(ctxOf(context), updatePage, { id: pageId, patch: { title: trimmed } }).ok;
}

export function setHomePage(context: PageActionContext, pageId: string): boolean {
  context.undoBoundary();
  return runCommand(ctxOf(context), updatePage, { id: pageId, patch: { isHome: true } }).ok;
}

export function removePage(context: PageActionContext, pageId: string): boolean {
  context.undoBoundary();
  return runCommand(ctxOf(context), deletePage, { id: pageId }).ok;
}

export function movePage(context: PageActionContext, order: readonly string[]): boolean {
  context.undoBoundary();
  return runCommand(ctxOf(context), reorderPages, { order: [...order] }).ok;
}
