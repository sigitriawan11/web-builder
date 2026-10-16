import * as Y from "yjs";
import { YDOC_KEYS } from "../yjs/mapping";

export type YNode = Y.Map<unknown>;

export function nodesMap(doc: Y.Doc): Y.Map<YNode> {
  return doc.getMap<YNode>(YDOC_KEYS.nodes);
}

export function nodeType(yNode: YNode): string {
  return String(yNode.get("type"));
}

export function parentIdOf(yNode: YNode): string | null {
  const parentId = yNode.get("parentId");
  return typeof parentId === "string" ? parentId : null;
}

// `undefined` berarti node bukan container.
export function childrenOf(yNode: YNode): Y.Array<string> | undefined {
  const children = yNode.get("children");
  return children instanceof Y.Array ? (children as Y.Array<string>) : undefined;
}

export function styleOf(yNode: YNode): Y.Map<Y.Map<unknown>> {
  const style = yNode.get("style");
  if (!(style instanceof Y.Map)) throw new Error(`Node "${String(yNode.get("id"))}" tidak punya style Y.Map`);
  return style as Y.Map<Y.Map<unknown>>;
}

// true jika `nodeId` sama dengan `ancestorId` atau berada di bawahnya.
export function isSelfOrDescendant(nodes: Y.Map<YNode>, nodeId: string, ancestorId: string): boolean {
  let current: string | null = nodeId;
  // Batas langkah melindungi dari siklus pada dokumen yang rusak.
  for (let steps = 0; current !== null && steps <= nodes.size; steps++) {
    if (current === ancestorId) return true;
    const yNode = nodes.get(current);
    current = yNode ? parentIdOf(yNode) : null;
  }
  return false;
}

// Node beserta seluruh turunannya (DFS).
export function collectSubtree(nodes: Y.Map<YNode>, rootId: string, into: Set<string> = new Set()): Set<string> {
  const stack = [rootId];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || into.has(id)) continue;
    into.add(id);
    const yNode = nodes.get(id);
    const children = yNode ? childrenOf(yNode) : undefined;
    if (children) stack.push(...children.toArray());
  }
  return into;
}

/** DM-075: node efektif terkunci bila node atau salah satu ancestornya `locked: true`. */
export function isEffectivelyLocked(nodes: Y.Map<YNode>, nodeId: string): boolean {
  let current: string | null = nodeId;
  const seen = new Set<string>();
  while (current && !seen.has(current)) {
    seen.add(current);
    const yNode = nodes.get(current);
    if (!yNode) return false;
    if (yNode.get("locked") === true) return true;
    current = parentIdOf(yNode);
  }
  return false;
}
